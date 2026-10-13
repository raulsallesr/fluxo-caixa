"""Gera a empresa fictícia: títulos de AR/AP, recorrentes, fluxo diário e saldo.

Tudo é censurado em `as_of`: pagamentos futuros não aparecem (data = NaT).
"""
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

from engine.agenda import RECUP_SOBRE_RECEITA, agenda_recorrentes
from engine.calendario import ajustar_dia_util, dias_uteis
from engine.sintetico.clientes import (
    CATEGORIAS_FORNECEDOR,
    SEGMENTOS,
    gerar_clientes,
    gerar_fornecedores,
)

SAZONALIDADE = np.array([0.92, 0.88, 0.97, 0.96, 1.0, 0.98, 0.99, 1.0, 1.02, 1.06, 1.12, 1.10])
DIAS_UTEIS_ANO = 252
AP_SOBRE_RECEITA = 0.72
TICKET_AP = 90_000


@dataclass(frozen=True)
class Config:
    seed: int = 42
    as_of: date = date(2026, 10, 13)
    dias_historico: int = 730
    receita_anual: float = 350e6
    caixa_inicial: float = 30e6


@dataclass
class Empresa:
    config: Config
    clientes: pd.DataFrame
    fornecedores: pd.DataFrame
    ar: pd.DataFrame
    ap: pd.DataFrame
    fluxo: pd.DataFrame  # data, tipo, categoria, subcategoria, valor (>0)
    saldo: pd.Series  # saldo final por dia com movimento


def _lognormal_ticket(rng, media, sigma, n):
    return media * rng.lognormal(-sigma**2 / 2, sigma, n)


def _dias_emissao(cfg, uteis):
    inicio = cfg.as_of - timedelta(days=cfg.dias_historico + 90)
    return uteis[(uteis >= np.datetime64(inicio)) & (uteis <= np.datetime64(cfg.as_of))]


def _mais_dias(datas, dias):
    return datas + np.asarray(dias).astype("timedelta64[D]")


def _gerar_ar(cfg, rng, clientes, uteis):
    dias = _dias_emissao(cfg, uteis)
    meses = pd.DatetimeIndex(dias).month.to_numpy()
    receita_dia = cfg.receita_anual / DIAS_UTEIS_ANO
    linhas = []
    for seg, p in SEGMENTOS.items():
        cli = clientes[clientes.segmento == seg].reset_index(drop=True)
        lam = receita_dia * p["share"] / p["ticket"]
        n_dia = rng.poisson(lam * SAZONALIDADE[meses - 1])
        total = int(n_dia.sum())
        emis = np.repeat(dias, n_dia)
        idx = rng.choice(len(cli), total, p=cli.peso.to_numpy())
        valor = np.round(_lognormal_ticket(rng, p["ticket"], p["sigma"], total), 2)
        venc = ajustar_dia_util(_mais_dias(emis, cli.prazo.to_numpy()[idx]), uteis)
        mediana = p["atraso_med"] * cli.fator_atraso.to_numpy()[idx]
        atraso = np.floor(rng.lognormal(np.log(mediana), 0.8)).astype(int)
        pago = ajustar_dia_util(_mais_dias(venc, atraso), uteis)
        perdido = rng.random(total) < p["default"]
        linhas.append(pd.DataFrame(dict(
            cliente_id=cli.cliente_id.to_numpy()[idx], segmento=seg, emissao=emis,
            vencimento=venc, valor=valor, pagamento=pago, perdido=perdido)))
    ar = pd.concat(linhas, ignore_index=True).sort_values("emissao", ignore_index=True)
    ar.insert(0, "titulo_id", [f"AR{i + 1:06d}" for i in range(len(ar))])
    asof = pd.Timestamp(cfg.as_of)
    recebido = ~ar.perdido & (ar.pagamento <= asof)
    perda_conhecida = ar.perdido & (ar.vencimento + pd.Timedelta(days=90) <= asof)
    ar["status"] = np.where(recebido, "pago", np.where(perda_conhecida, "inadimplente", "aberto"))
    # censura: o futuro (e o fato de ser perda) não é conhecido em as_of
    ar["pagamento"] = ar.pagamento.where(recebido, pd.NaT)
    return ar.drop(columns="perdido")


def _gerar_ap(cfg, rng, fornecedores, uteis):
    dias = _dias_emissao(cfg, uteis)
    meses = pd.DatetimeIndex(dias).month.to_numpy()
    # compras antecipam as vendas: sazonalidade do mês seguinte
    fator = SAZONALIDADE[meses % 12]
    lam = cfg.receita_anual / DIAS_UTEIS_ANO * AP_SOBRE_RECEITA / TICKET_AP
    n_dia = rng.poisson(lam * fator)
    total = int(n_dia.sum())
    emis = np.repeat(dias, n_dia)
    pesos = np.array([CATEGORIAS_FORNECEDOR[c]["peso"] for c in fornecedores.categoria])
    idx = rng.choice(len(fornecedores), total, p=pesos / pesos.sum())
    valor = np.round(_lognormal_ticket(rng, TICKET_AP, 0.6, total), 2)
    venc = ajustar_dia_util(_mais_dias(emis, fornecedores.prazo.to_numpy()[idx]), uteis)
    atraso = np.where(rng.random(total) < 0.25, rng.integers(1, 6, total), 0)
    pago = ajustar_dia_util(_mais_dias(venc, atraso), uteis)
    ap = pd.DataFrame(dict(
        fornecedor_id=fornecedores.fornecedor_id.to_numpy()[idx],
        categoria=fornecedores.categoria.to_numpy()[idx],
        emissao=emis, vencimento=venc, valor=valor, pagamento=pago))
    ap.insert(0, "titulo_id", [f"AP{i + 1:06d}" for i in range(len(ap))])
    pago_ok = ap.pagamento <= pd.Timestamp(cfg.as_of)
    ap["status"] = np.where(pago_ok, "pago", "aberto")
    ap["pagamento"] = ap.pagamento.where(pago_ok, pd.NaT)
    return ap


def _recorrentes(cfg, ar, rng):
    """Realizado dos recorrentes: mesma agenda da projeção, com recuperação aleatória."""
    ini = cfg.as_of - timedelta(days=cfg.dias_historico)
    emis_mes = ar.groupby(ar.emissao.dt.to_period("M")).valor.sum()
    linhas = agenda_recorrentes(
        ini, cfg.as_of, cfg.receita_anual,
        base_mes=lambda p: float(emis_mes.get(p, 0.0)),
        recup=lambda: cfg.receita_anual * RECUP_SOBRE_RECEITA / 12 * rng.uniform(0.3, 1.7))
    return pd.DataFrame(linhas)


def gerar_empresa(cfg: Config | None = None) -> Empresa:
    cfg = cfg or Config()
    rng = np.random.default_rng(cfg.seed)
    clientes = gerar_clientes(rng)
    fornecedores = gerar_fornecedores(rng)
    uteis = dias_uteis(cfg.as_of - timedelta(days=cfg.dias_historico + 200),
                       cfg.as_of + timedelta(days=500))
    ar = _gerar_ar(cfg, rng, clientes, uteis)
    ap = _gerar_ap(cfg, rng, fornecedores, uteis)
    rec = _recorrentes(cfg, ar, rng)
    ini = pd.Timestamp(cfg.as_of - timedelta(days=cfg.dias_historico))

    ent = ar[ar.pagamento.notna()].rename(columns={"pagamento": "data", "segmento": "subcategoria"})
    ent = ent.assign(tipo="entrada", categoria="Recebimentos de clientes")
    sai = ap[ap.pagamento.notna()].rename(columns={"pagamento": "data", "categoria": "subcategoria"})
    sai = sai.assign(tipo="saida", categoria="Fornecedores")
    cols = ["data", "tipo", "categoria", "subcategoria", "valor"]
    rec["data"] = pd.to_datetime(rec["data"])
    fluxo = pd.concat([ent[cols], sai[cols], rec[cols]], ignore_index=True)
    fluxo = fluxo[(fluxo.data >= ini) & (fluxo.data <= pd.Timestamp(cfg.as_of))]
    fluxo = fluxo.sort_values(["data", "tipo", "categoria"], ignore_index=True)
    sinal = np.where(fluxo.tipo == "entrada", fluxo.valor, -fluxo.valor)
    saldo = cfg.caixa_inicial + pd.Series(sinal, index=fluxo.data).groupby(level=0).sum().cumsum()
    return Empresa(cfg, clientes, fornecedores, ar, ap, fluxo, saldo)
