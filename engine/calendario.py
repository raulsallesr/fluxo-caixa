"""Calendário de dias úteis do Brasil (feriados nacionais)."""
from datetime import date, timedelta

import holidays
import numpy as np
import pandas as pd


def feriados_br(ano: int) -> holidays.HolidayBase:
    return holidays.country_holidays("BR", years=ano)


def eh_dia_util(d: date) -> bool:
    return d.weekday() < 5 and d not in feriados_br(d.year)


def proximo_dia_util(d: date) -> date:
    while not eh_dia_util(d):
        d += timedelta(days=1)
    return d


def enesimo_dia_util(ano: int, mes: int, n: int) -> date:
    """N-ésimo dia útil do mês (ex.: 5º dia útil para folha)."""
    d = date(ano, mes, 1)
    cont = 0
    while True:
        if eh_dia_util(d):
            cont += 1
            if cont == n:
                return d
        d += timedelta(days=1)


def anterior_dia_util(d: date) -> date:
    while not eh_dia_util(d):
        d -= timedelta(days=1)
    return d


def dias_uteis(inicio: date, fim: date) -> np.ndarray:
    """Dias úteis em [inicio, fim] como array datetime64[D] ordenado."""
    todos = pd.date_range(inicio, fim, freq="D")
    return np.array([d.date() for d in todos if eh_dia_util(d.date())], dtype="datetime64[D]")


def ajustar_dia_util(datas: np.ndarray, uteis: np.ndarray) -> np.ndarray:
    """Empurra cada data para o próximo dia útil (`uteis` deve cobrir além do máximo)."""
    idx = np.minimum(np.searchsorted(uteis, datas, side="left"), len(uteis) - 1)
    return uteis[idx]


class Cal:
    """Eixo de dias úteis: converte datas em índices inteiros (atrasos em dias úteis)."""

    def __init__(self, inicio: date, fim: date):
        self.uteis = dias_uteis(inicio, fim)

    def idx(self, d: date) -> int:
        """Índice do dia útil de `d` (ou do próximo, se `d` não for útil)."""
        return int(np.searchsorted(self.uteis, np.datetime64(d)))

    def idx_arr(self, datas) -> np.ndarray:
        return np.searchsorted(self.uteis, np.asarray(datas, dtype="datetime64[D]"))

    def data(self, i: int) -> date:
        return self.uteis[i].astype(object)
