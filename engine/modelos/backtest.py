"""Backtest rolling-origin do horizonte de 13 semanas, comparado ao método 'média do passado'."""
from datetime import date

import numpy as np
import pandas as pd

from engine.calendario import Cal
from engine.modelos import previsao as pv
from engine.safras import wape

SEMANA = 5


def _diario(fluxo: pd.DataFrame, cal: Cal, i0: int, h: int):
    """Entradas e saídas realizadas por dia útil para os índices i0..i0+h-1."""
    datas = pd.DatetimeIndex(cal.uteis[i0:i0 + h])
    p = fluxo.pivot_table(index="data", columns="tipo", values="valor", aggfunc="sum").reindex(
        datas, fill_value=0.0).fillna(0.0)
    return p["entrada"].to_numpy(), p["saida"].to_numpy()


def backtest_horizonte(ar, ap, fluxo, saldo, as_of: date, receita_anual: float, cal: Cal,
                       caixa_minimo: float, horizonte: int = 65, n_origens: int = 12,
                       passo: int = 10, n_caminhos: int = 1000, seed: int = 0) -> dict:
    idx_fim = cal.idx(as_of)
    semanas = horizonte // SEMANA
    erros = {k: [] for k in ("ent_m", "ent_b", "sai_m", "sai_b", "ent_r", "sai_r")}
    cob = {"p10_p90": [], "p5_p95": []}
    saldo_err_m, saldo_err_b, saldo_ref = [], [], []
    origens = []
    for k in range(n_origens):
        io = idx_fim - horizonte - k * passo
        origem = cal.data(io)
        modelo = pv.ajustar(ar, ap, fluxo, origem, receita_anual, cal)
        est = pv.estado_em(ar, ap, saldo, origem, cal)
        a = ar[ar.emissao <= pd.Timestamp(origem)]
        emis = a.groupby(a.emissao.dt.to_period("M")).valor.sum()
        ag = pv.agenda_futura(modelo, est, emis, cal, horizonte)
        ent, sai = pv.simular(modelo, est, ag, cal, n_caminhos, seed + k, horizonte)
        real_e, real_s = _diario(fluxo, cal, io + 1, horizonte)
        saldo_real = est.saldo0 + np.cumsum(real_e - real_s)
        r = pv.resumir(est.saldo0, ent, sai, caixa_minimo)

        # baseline: média semanal das últimas 13 semanas realizadas antes da origem
        pe, ps = _diario(fluxo, cal, io - horizonte + 1, horizonte)
        base_e, base_s = pe.sum() / semanas, ps.sum() / semanas
        for w in range(semanas):
            sl = slice(w * SEMANA, (w + 1) * SEMANA)
            erros["ent_m"].append(np.median(ent[:, sl].sum(1)))
            erros["sai_m"].append(np.median(sai[:, sl].sum(1)))
            erros["ent_b"].append(base_e)
            erros["sai_b"].append(base_s)
            erros["ent_r"].append(real_e[sl].sum())
            erros["sai_r"].append(real_s[sl].sum())
            d = (w + 1) * SEMANA - 1
            lo10, hi90 = r["quantis"]["p10"][d], r["quantis"]["p90"][d]
            lo5, hi95 = r["quantis"]["p5"][d], r["quantis"]["p95"][d]
            cob["p10_p90"].append(lo10 <= saldo_real[d] <= hi90)
            cob["p5_p95"].append(lo5 <= saldo_real[d] <= hi95)
            saldo_err_m.append(abs(r["quantis"]["p50"][d] - saldo_real[d]))
            base_saldo = est.saldo0 + (base_e - base_s) / SEMANA * (d + 1)
            saldo_err_b.append(abs(base_saldo - saldo_real[d]))
            saldo_ref.append(abs(saldo_real[d]))
        origens.append(origem.isoformat())
    e = {k: np.array(v) for k, v in erros.items()}
    return dict(
        n_origens=n_origens, horizonte_semanas=semanas, origens=origens,
        entradas=dict(wape_modelo=round(wape(e["ent_m"], e["ent_r"]), 4),
                      wape_baseline=round(wape(e["ent_b"], e["ent_r"]), 4)),
        saidas=dict(wape_modelo=round(wape(e["sai_m"], e["sai_r"]), 4),
                    wape_baseline=round(wape(e["sai_b"], e["sai_r"]), 4)),
        saldo=dict(erro_medio_modelo=round(float(np.mean(saldo_err_m)), 0),
                   erro_medio_baseline=round(float(np.mean(saldo_err_b)), 0),
                   erro_relativo_modelo=round(float(np.sum(saldo_err_m) / np.sum(saldo_ref)), 4),
                   erro_relativo_baseline=round(float(np.sum(saldo_err_b) / np.sum(saldo_ref)), 4)),
        cobertura=dict(p10_p90=round(float(np.mean(cob["p10_p90"])), 3),
                       p5_p95=round(float(np.mean(cob["p5_p95"])), 3)),
    )
