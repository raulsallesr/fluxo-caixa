"""Safras: a projeção feita no dia útil anterior para cada dia passado (realizado x projetado honesto).

O modelo é congelado numa data de corte anterior à janela, então nenhuma projeção "enxerga"
o futuro dela.
"""
from datetime import date

import numpy as np
import pandas as pd

from engine.calendario import Cal
from engine.modelos import previsao as pv

CHAVE = ["tipo", "categoria", "subcategoria"]


def _emis_mes_ate(ar: pd.DataFrame, origem: date) -> pd.Series:
    a = ar[ar.emissao <= pd.Timestamp(origem)]
    return a.groupby(a.emissao.dt.to_period("M")).valor.sum()


def projetar_dia(modelo: pv.ModeloCaixa, ar: pd.DataFrame, ap: pd.DataFrame, saldo: pd.Series,
                 dia: date, cal: Cal) -> pd.DataFrame:
    """Projeção do dia `dia` feita ao fim do dia útil anterior (colunas CHAVE + projetado)."""
    origem = pv.dia_anterior(dia, cal)
    est = pv.estado_em(ar, ap, saldo, origem, cal)
    esp = pv.esperado_diario(modelo, est, np.array([cal.idx(dia)]))
    ag = pv.agenda_futura(modelo, est, _emis_mes_ate(ar, origem), cal, 1)
    p = pd.concat([esp[CHAVE + ["valor"]], ag[CHAVE + ["valor"]]], ignore_index=True)
    return p.groupby(CHAVE, as_index=False).valor.sum().rename(columns={"valor": "projetado"})


def construir_safras(modelo: pv.ModeloCaixa, ar: pd.DataFrame, ap: pd.DataFrame,
                     fluxo: pd.DataFrame, saldo: pd.Series, dias: list[date],
                     cal: Cal) -> pd.DataFrame:
    """Uma linha por (dia, tipo, categoria, subcategoria) com projetado e realizado."""
    linhas = []
    real = fluxo.groupby(["data"] + CHAVE, as_index=False).valor.sum()
    for d in dias:
        p = projetar_dia(modelo, ar, ap, saldo, d, cal)
        r = real[real.data == pd.Timestamp(d)][CHAVE + ["valor"]].rename(
            columns={"valor": "realizado"})
        m = p.merge(r, on=CHAVE, how="outer").fillna({"projetado": 0.0, "realizado": 0.0})
        m.insert(0, "data", pd.Timestamp(d))
        linhas.append(m)
    return pd.concat(linhas, ignore_index=True)


def baseline_trinus(fluxo: pd.DataFrame, dia: date, cal: Cal, meses: int = 3) -> dict[str, float]:
    """Método 'média do passado': mesmo n-ésimo dia útil do mês nos `meses` meses anteriores."""
    i = cal.idx(dia)
    dias_mes = cal.uteis[(pd.DatetimeIndex(cal.uteis).to_period("M") == pd.Period(dia, "M"))]
    n = i - cal.idx(dias_mes[0].astype(object))
    out = {"entrada": [], "saida": []}
    por_dia = fluxo.groupby(["data", "tipo"]).valor.sum()
    p = pd.Period(dia, "M")
    for k in range(1, meses + 1):
        pk = p - k
        du = cal.uteis[pd.DatetimeIndex(cal.uteis).to_period("M") == pk]
        if n >= len(du):
            continue
        d = pd.Timestamp(du[n])
        for tipo, lista in out.items():
            lista.append(float(por_dia.get((d, tipo), 0.0)))
    return {t: (float(np.mean(v)) if v else 0.0) for t, v in out.items()}


def wape(proj: np.ndarray, real: np.ndarray) -> float:
    return float(np.abs(proj - real).sum() / max(np.abs(real).sum(), 1e-9))


def metricas_diarias(safras: pd.DataFrame, fluxo: pd.DataFrame, cal: Cal) -> dict:
    """WAPE diário do modelo vs baseline, para entradas e saídas."""
    tot = safras.groupby(["data", "tipo"])[["projetado", "realizado"]].sum().reset_index()
    out = {}
    for tipo in ("entrada", "saida"):
        t = tot[tot.tipo == tipo]
        base = np.array([baseline_trinus(fluxo, d.date(), cal)[tipo] for d in t.data])
        out[tipo] = dict(wape_modelo=round(wape(t.projetado.to_numpy(), t.realizado.to_numpy()), 4),
                         wape_baseline=round(wape(base, t.realizado.to_numpy()), 4))
    return out
