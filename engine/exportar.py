"""Monta e grava o snapshot (web/public/data/snapshot.json)."""
import argparse
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from engine import safras as sf
from engine.calendario import Cal, anterior_dia_util
from engine.modelos import previsao as pv
from engine.modelos.backtest import backtest_horizonte
from engine.modelos.pagamento import Pag
from engine.sintetico.gerar import Config, gerar_empresa
from engine.snapshot import (
    AgendaItem,
    CurvaPagamento,
    Geracao,
    LinhaCategoria,
    LinhaDiario,
    ModeloSnapshot,
    ProjecaoBase,
    Snapshot,
    TituloAP,
    TituloAR,
)

NOME_EMPRESA = "Distribuidora Maré Alta S.A. (fictícia)"
CAIXA_MINIMO = 15_000_000.0
HORIZONTE = 65
JANELA_DIARIO = 90
FUTURO_DIARIO = 10
N_CAMINHOS_BASE = 5000
CAL_ANTES = 200  # dias úteis antes da origem exportados no calendário
CAL_DEPOIS = 200


def _curva(p: Pag) -> CurvaPagamento:
    return CurvaPagamento(pmf=[round(float(x), 6) for x in p.pmf], p_perda=round(p.p_perda, 6))


def _geracao(p: pv.ParamsGeracao) -> Geracao:
    return Geracao(lam=[round(float(x), 6) for x in p.lam], ticket=round(p.ticket, 2),
                   sigma=round(p.sigma, 6), prazos=[int(x) for x in p.prazos],
                   pesos=[round(float(x), 6) for x in p.pesos])


def _num(x) -> float | None:
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), 2)


def montar_snapshot(cfg: Config | None = None, n_caminhos: int = N_CAMINHOS_BASE,
                    n_origens: int = 12) -> Snapshot:
    cfg = cfg or Config()
    emp = gerar_empresa(cfg)
    as_of = cfg.as_of
    cal = Cal(as_of - timedelta(days=1100), as_of + timedelta(days=600))
    io = cal.idx(as_of)

    # --- safras (modelo congelado antes da janela) ---
    dias = [cal.data(k) for k in range(io - JANELA_DIARIO + 1, io + 1)]
    modelo_safra = pv.ajustar(emp.ar, emp.ap, emp.fluxo, cal.data(io - JANELA_DIARIO),
                              cfg.receita_anual, cal)
    safras = sf.construir_safras(modelo_safra, emp.ar, emp.ap, emp.fluxo, emp.saldo, dias, cal)

    # --- modelo atual e projeção futura ---
    modelo = pv.ajustar(emp.ar, emp.ap, emp.fluxo, as_of, cfg.receita_anual, cal)
    est = pv.estado_em(emp.ar, emp.ap, emp.saldo, as_of, cal)
    emis = emp.ar.groupby(emp.ar.emissao.dt.to_period("M")).valor.sum()
    agenda = pv.agenda_futura(modelo, est, emis, cal, HORIZONTE)
    ent, sai = pv.simular(modelo, est, agenda, cal, n_caminhos, seed=2026, horizonte=HORIZONTE)
    res = pv.resumir(est.saldo0, ent, sai, CAIXA_MINIMO)
    datas_h = [d.isoformat() for d in pv.horizonte_datas(cal, as_of, HORIZONTE)]

    # --- esperado dos próximos dias (visão "Hoje", lado projetado) ---
    fut_idx = np.arange(io + 1, io + 1 + FUTURO_DIARIO)
    esp = pv.esperado_diario(modelo, est, fut_idx)
    ag_f = agenda[agenda.idx.isin(fut_idx)][["idx", "tipo", "categoria", "subcategoria", "valor"]]
    fut = pd.concat([esp, ag_f]).groupby(["idx"] + sf.CHAVE, as_index=False).valor.sum()

    # --- tabelas do app ---
    diario, categorias = [], []
    tot = safras.groupby(["data", "tipo"])[["projetado", "realizado"]].sum().unstack()
    saldo_fim = emp.saldo
    for d in dias:
        ts = pd.Timestamp(d)
        ini = float(saldo_fim[saldo_fim.index < ts].iloc[-1])
        ep, er = tot.loc[ts, ("projetado", "entrada")], tot.loc[ts, ("realizado", "entrada")]
        sp, sr = tot.loc[ts, ("projetado", "saida")], tot.loc[ts, ("realizado", "saida")]
        diario.append(LinhaDiario(
            data=d.isoformat(), futuro=False, saldo_inicial=round(ini, 2),
            entradas_proj=round(ep, 2), entradas_real=round(er, 2),
            saidas_proj=round(sp, 2), saidas_real=round(sr, 2),
            saldo_final_esperado=round(ini + ep - sp, 2), saldo_final_real=round(ini + er - sr, 2)))
    for r in safras.itertuples():
        categorias.append(LinhaCategoria(
            data=r.data.date().isoformat(), tipo=r.tipo, categoria=r.categoria,
            subcategoria=r.subcategoria, projetado=round(r.projetado, 2),
            realizado=round(r.realizado, 2)))
    ini = est.saldo0
    for i in fut_idx:
        f = fut[fut.idx == i]
        ep = float(f[f.tipo == "entrada"].valor.sum())
        sp = float(f[f.tipo == "saida"].valor.sum())
        d = cal.data(int(i)).isoformat()
        diario.append(LinhaDiario(
            data=d, futuro=True, saldo_inicial=round(ini, 2), entradas_proj=round(ep, 2),
            entradas_real=None, saidas_proj=round(sp, 2), saidas_real=None,
            saldo_final_esperado=round(ini + ep - sp, 2), saldo_final_real=None))
        ini += ep - sp
        for r in f.itertuples():
            categorias.append(LinhaCategoria(
                data=d, tipo=r.tipo, categoria=r.categoria, subcategoria=r.subcategoria,
                projetado=round(r.valor, 2), realizado=None))

    off = io - CAL_ANTES
    cliente = est.ar
    titulos_ar = [TituloAR(id=r.titulo_id, cliente=r.cliente_id, segmento=r.segmento,
                           venc_idx=int(r.venc_idx - off), valor=round(r.valor, 2))
                  for r in cliente.itertuples()]
    titulos_ap = [TituloAP(id=r.titulo_id, categoria=r.categoria, venc_idx=int(r.venc_idx - off),
                           valor=round(r.valor, 2)) for r in est.ap.itertuples()]
    ag_items = [AgendaItem(data=r.data.isoformat(), idx=int(r.idx - off), tipo=r.tipo,
                           categoria=r.categoria, subcategoria=r.subcategoria,
                           valor=round(r.valor, 2)) for r in agenda.itertuples()]
    cal_exp = [cal.data(k).isoformat() for k in range(off, io + CAL_DEPOIS)]

    s_hist = emp.saldo[emp.saldo.index >= pd.Timestamp(cal.data(io - 250))]
    bt = backtest_horizonte(emp.ar, emp.ap, emp.fluxo, emp.saldo, as_of, cfg.receita_anual, cal,
                            CAIXA_MINIMO, HORIZONTE, n_origens=n_origens)
    bt["diario"] = sf.metricas_diarias(safras, emp.fluxo, cal)

    return Snapshot(
        empresa=NOME_EMPRESA, gerado_em=datetime.now().isoformat(timespec="seconds"),
        as_of=as_of.isoformat(), caixa_minimo=CAIXA_MINIMO, horizonte=HORIZONTE,
        calendario=cal_exp, idx_origem=io - off,
        saldo_historico=[(i.date().isoformat(), round(float(v), 2)) for i, v in s_hist.items()],
        diario=diario, categorias=categorias, titulos_ar=titulos_ar, titulos_ap=titulos_ap,
        agenda=ag_items,
        modelo=ModeloSnapshot(
            ar_curva={k: _curva(v) for k, v in modelo.ar_pag.items()},
            ar_geracao={k: _geracao(v) for k, v in modelo.ar_geracao.items()},
            ap_curva=_curva(modelo.ap_pag), ap_geracao=_geracao(modelo.ap_geracao),
            ap_categorias={k: round(float(v), 6) for k, v in modelo.ap_categorias.items()}),
        projecao_base=ProjecaoBase(n_caminhos=n_caminhos, datas=datas_h, **res),
        backtest=bt)


def gravar(destino: Path, **kw) -> Snapshot:
    snap = montar_snapshot(**kw)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(snap.model_dump_json(), encoding="utf-8")
    return snap


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--saida", default="web/public/data/snapshot.json")
    ap.add_argument("--as-of", default=None,
                    help="AAAA-MM-DD, ou 'hoje' (dia útil mais recente); padrão: data da config")
    a = ap.parse_args()
    if a.as_of == "hoje":
        cfg = Config(as_of=anterior_dia_util(date.today()))
    else:
        cfg = Config(as_of=date.fromisoformat(a.as_of)) if a.as_of else Config()
    s = gravar(Path(a.saida), cfg=cfg)
    print(f"snapshot v{s.versao} gravado em {a.saida} (as_of {s.as_of})")
