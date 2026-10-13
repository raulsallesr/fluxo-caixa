"""Modelo de previsão de caixa: ajuste, valor esperado diário e simulação Monte Carlo.

Método:
  1. Método direto para o que já é conhecido: títulos em aberto (AR/AP) e agenda de recorrentes.
  2. Curva de pagamento empírica por segmento (atraso em dias úteis + probabilidade de perda)
     para decidir *quando* cada título aberto entra/sai do caixa.
  3. Processo de Poisson sazonal para faturas/compras futuras ainda não emitidas.
"""
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

from engine.agenda import RECUP_SOBRE_RECEITA, agenda_recorrentes
from engine.calendario import Cal
from engine.modelos.pagamento import Pag, ajustar_pag, amostrar_atraso, prob_pagar

CARENCIA_DIAS = 130  # título só entra no ajuste da curva depois de vencido há mais que isso
BAIXA_DIAS = 90  # título vencido há mais que isso e não pago é tratado como perda conhecida
NEG = -10**9


@dataclass(frozen=True)
class ParamsGeracao:
    """Faturas (ou compras) futuras: contagem diária sazonal, valor lognormal e prazo."""

    lam: np.ndarray  # intensidade por dia útil, por mês (12)
    ticket: float
    sigma: float
    prazos: np.ndarray
    pesos: np.ndarray


@dataclass
class ModeloCaixa:
    corte: date
    ar_pag: dict[str, Pag]
    ar_geracao: dict[str, ParamsGeracao]
    ap_pag: Pag
    ap_geracao: ParamsGeracao
    ap_categorias: pd.Series  # participação de cada categoria nas compras
    recup_esperada: float
    receita_anual: float


@dataclass
class Estado:
    origem: date
    idx_o: int
    saldo0: float
    ar: pd.DataFrame  # titulo_id, cliente_id, segmento, valor, venc_idx
    ap: pd.DataFrame  # titulo_id, categoria, valor, venc_idx


def _d(serie) -> np.ndarray:
    return np.asarray(serie).astype("datetime64[D]")


def _atrasos_bd(df: pd.DataFrame, corte: date, cal: Cal) -> tuple[np.ndarray, int]:
    c = pd.Timestamp(corte)
    usavel = df[df.vencimento <= c - pd.Timedelta(days=CARENCIA_DIAS)]
    pago = usavel[usavel.pagamento.notna() & (usavel.pagamento <= c)]
    return cal.idx_arr(_d(pago.pagamento)) - cal.idx_arr(_d(pago.vencimento)), len(usavel)


def _ajustar_geracao(df: pd.DataFrame, corte: date, cal: Cal) -> ParamsGeracao:
    d = df[df.emissao <= pd.Timestamp(corte)]
    ini = d.emissao.min()
    uteis = cal.uteis[(cal.uteis >= np.datetime64(ini)) & (cal.uteis <= np.datetime64(corte))]
    bd_mes = pd.Series(pd.DatetimeIndex(uteis).month).value_counts()
    cont = d.groupby(d.emissao.dt.month).size()
    lam = np.array([cont.get(m, 0) / max(bd_mes.get(m, 1), 1) for m in range(1, 13)])
    prazo = (d.vencimento - d.emissao).dt.days.to_numpy()
    vals, cnt = np.unique(prazo, return_counts=True)
    return ParamsGeracao(lam=lam, ticket=float(d.valor.mean()),
                         sigma=float(np.log(d.valor).std()), prazos=vals, pesos=cnt / cnt.sum())


def ajustar(ar: pd.DataFrame, ap: pd.DataFrame, fluxo: pd.DataFrame, corte: date,
            receita_anual: float, cal: Cal) -> ModeloCaixa:
    """Ajusta o modelo usando só informação disponível em `corte`."""
    ar_pag, ar_ger = {}, {}
    for seg, g in ar.groupby("segmento"):
        atr, n = _atrasos_bd(g, corte, cal)
        ar_pag[seg] = ajustar_pag(atr, n)
        ar_ger[seg] = _ajustar_geracao(g, corte, cal)
    atr, n = _atrasos_bd(ap, corte, cal)
    compras = ap[ap.emissao <= pd.Timestamp(corte)]
    recup = fluxo[(fluxo.subcategoria == "Recuperação de impostos")
                  & (fluxo.data <= pd.Timestamp(corte))].valor
    return ModeloCaixa(
        corte=corte, ar_pag=ar_pag, ar_geracao=ar_ger, ap_pag=ajustar_pag(atr, n),
        ap_geracao=_ajustar_geracao(ap, corte, cal),
        ap_categorias=compras.groupby("categoria").valor.sum() / compras.valor.sum(),
        recup_esperada=float(recup.mean()) if len(recup) else receita_anual * RECUP_SOBRE_RECEITA / 12,
        receita_anual=receita_anual)


def estado_em(ar: pd.DataFrame, ap: pd.DataFrame, saldo: pd.Series, origem: date,
              cal: Cal) -> Estado:
    """Carteira aberta ao fim do dia `origem` (só o que era conhecido nesse dia)."""
    o = pd.Timestamp(origem)
    baixa = o - pd.Timedelta(days=BAIXA_DIAS)

    def abertos(df):
        m = (df.emissao <= o) & (df.pagamento.isna() | (df.pagamento > o)) & (df.vencimento > baixa)
        t = df[m].copy()
        t["venc_idx"] = cal.idx_arr(_d(t.vencimento))
        return t.reset_index(drop=True)

    s = saldo[saldo.index <= o]
    return Estado(origem=origem, idx_o=cal.idx(origem), saldo0=float(s.iloc[-1]),
                  ar=abertos(ar)[["titulo_id", "cliente_id", "segmento", "valor", "venc_idx"]],
                  ap=abertos(ap)[["titulo_id", "categoria", "valor", "venc_idx"]])


def esperado_diario(modelo: ModeloCaixa, est: Estado, dias_idx: np.ndarray) -> pd.DataFrame:
    """Valor esperado por dia, só dos títulos em aberto (sem faturas futuras)."""
    dias_idx = np.asarray(dias_idx)
    linhas = []

    def bloco(t, pag, tipo, categoria, chave):
        for k, g in t.groupby(chave):
            kd = dias_idx[None, :] - g.venc_idx.to_numpy()[:, None]
            ko = (est.idx_o - g.venc_idx.to_numpy())[:, None]
            v = (g.valor.to_numpy()[:, None] * prob_pagar(pag, kd, ko)).sum(0)
            for i, x in zip(dias_idx, v, strict=True):
                linhas.append(dict(idx=int(i), tipo=tipo, categoria=categoria,
                                   subcategoria=k, valor=float(x)))

    for seg, pag in modelo.ar_pag.items():
        bloco(est.ar[est.ar.segmento == seg], pag, "entrada", "Recebimentos de clientes",
              "segmento")
    bloco(est.ap, modelo.ap_pag, "saida", "Fornecedores", "categoria")
    return pd.DataFrame(linhas, columns=["idx", "tipo", "categoria", "subcategoria", "valor"])


def agenda_futura(modelo: ModeloCaixa, est: Estado, emis_mes: pd.Series, cal: Cal,
                  horizonte: int) -> pd.DataFrame:
    """Recorrentes conhecidos nos próximos `horizonte` dias úteis (idx, tipo, cat, sub, valor)."""
    receita_dia = {m: sum(p.lam[m - 1] * p.ticket for p in modelo.ar_geracao.values())
                   for m in range(1, 13)}
    meses_uteis = pd.Series(pd.DatetimeIndex(cal.uteis).to_period("M"))

    def base_mes(p: pd.Period) -> float:
        real = float(emis_mes.get(p, 0.0))
        fut = int(((meses_uteis == p) & (np.arange(len(cal.uteis)) > est.idx_o)).sum())
        return real + fut * receita_dia[p.month]

    ini = cal.data(est.idx_o + 1)
    fim = cal.data(est.idx_o + horizonte)
    linhas = agenda_recorrentes(ini, fim, modelo.receita_anual, base_mes,
                                recup=lambda: modelo.recup_esperada)
    df = pd.DataFrame(linhas, columns=["data", "tipo", "categoria", "subcategoria", "valor"])
    df["idx"] = cal.idx_arr(_d(pd.to_datetime(df.data)))
    return df


def _novos(p: ParamsGeracao, pag: Pag, rng, n: int, idx0: int, h: int, cal: Cal):
    """Faturas futuras sorteadas: (caminho, valor, idx do pagamento)."""
    e_idx = np.arange(idx0, idx0 + h)
    mes = cal.uteis[e_idx].astype("datetime64[M]").astype(int) % 12
    cont = rng.poisson(p.lam[mes][None, :], size=(n, h)).ravel()
    caminho = np.repeat(np.arange(n * h) // h, cont)
    emis_idx = np.repeat(np.tile(e_idx, n), cont)
    m = len(caminho)
    valor = p.ticket * rng.lognormal(-p.sigma**2 / 2, p.sigma, m)
    prazo = rng.choice(p.prazos, m, p=p.pesos).astype("timedelta64[D]")
    venc_idx = cal.idx_arr(cal.uteis[emis_idx] + prazo)
    j = amostrar_atraso(pag, np.full(m, -1), rng.random(m))
    return caminho, valor, np.where(j < 0, NEG, venc_idx + j)


def simular(modelo: ModeloCaixa, est: Estado, agenda: pd.DataFrame, cal: Cal, n: int,
            seed: int, horizonte: int = 65) -> tuple[np.ndarray, np.ndarray]:
    """Monte Carlo: devolve entradas e saídas diárias, formato (n, horizonte)."""
    rng = np.random.default_rng(seed)
    h = horizonte
    idx0 = est.idx_o + 1
    ent, sai = np.zeros(n * h), np.zeros(n * h)

    def acumula(alvo, pay_idx, caminho, valor):
        d = pay_idx - idx0
        ok = (pay_idx > NEG // 2) & (d >= 0) & (d < h)
        alvo += np.bincount(caminho[ok] * h + d[ok], weights=valor[ok], minlength=n * h)

    def abertos(alvo, t, pag):
        if not len(t):
            return
        venc = t.venc_idx.to_numpy()
        j = amostrar_atraso(pag, (est.idx_o - venc)[None, :], rng.random((n, len(t))))
        pay = np.where(j < 0, NEG, venc[None, :] + j)
        acumula(alvo, pay.ravel(), np.repeat(np.arange(n), len(t)), np.tile(t.valor.to_numpy(), n))

    for seg, pag in modelo.ar_pag.items():
        abertos(ent, est.ar[est.ar.segmento == seg], pag)
        c, v, p = _novos(modelo.ar_geracao[seg], pag, rng, n, idx0, h, cal)
        acumula(ent, p, c, v)
    abertos(sai, est.ap, modelo.ap_pag)
    c, v, p = _novos(modelo.ap_geracao, modelo.ap_pag, rng, n, idx0, h, cal)
    acumula(sai, p, c, v)
    ent, sai = ent.reshape(n, h), sai.reshape(n, h)
    for tipo, alvo in (("entrada", ent), ("saida", sai)):
        a = agenda[(agenda.tipo == tipo) & (agenda.idx >= idx0) & (agenda.idx < idx0 + h)]
        for i, v in a.groupby("idx").valor.sum().items():
            alvo[:, i - idx0] += v
    return ent, sai


QUANTIS = (5, 10, 25, 50, 75, 90, 95)


def resumir(saldo0: float, ent: np.ndarray, sai: np.ndarray, caixa_minimo: float) -> dict:
    """Quantis do saldo por dia, P(saldo < mínimo) e métricas de risco."""
    saldo = saldo0 + np.cumsum(ent - sai, axis=1)
    q = np.percentile(saldo, QUANTIS, axis=0)
    abaixo = (saldo < caixa_minimo)
    primeira = np.where(abaixo.any(1), abaixo.argmax(1), -1)
    return dict(
        quantis={f"p{p}": q[i].round(0).tolist() for i, p in enumerate(QUANTIS)},
        p_abaixo_minimo=abaixo.mean(0).round(4).tolist(),
        p_romper_no_horizonte=float(abaixo.any(1).mean()),
        primeira_ruptura_p50=(int(np.median(primeira[primeira >= 0]))
                              if (primeira >= 0).any() else None),
        cash_at_risk=float(saldo0 - np.percentile(saldo.min(1), 5)),
    )


def horizonte_datas(cal: Cal, origem: date, h: int) -> list[date]:
    i = cal.idx(origem)
    return [cal.data(i + k) for k in range(1, h + 1)]


def dia_anterior(d: date, cal: Cal) -> date:
    """Dia útil imediatamente anterior a `d`."""
    return cal.data(cal.idx(d) - 1) if cal.idx(d) > 0 else d - timedelta(days=1)
