"""Calendário de dias úteis do Brasil (feriados nacionais)."""
from datetime import date, timedelta

import holidays


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
