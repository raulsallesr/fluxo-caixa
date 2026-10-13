"""Agenda de recorrentes (folha, encargos, tributos, aluguel, dívida, sócios).

Os mesmos contratos geram o realizado (gerador sintético) e o futuro conhecido (projeção).
"""
from collections.abc import Callable
from datetime import date

import pandas as pd

from engine.calendario import anterior_dia_util, enesimo_dia_util, proximo_dia_util

ALIQ_ICMS = 0.06
ALIQ_PIS_COFINS = 0.035
FOLHA_SOBRE_RECEITA = 0.06
RECUP_SOBRE_RECEITA = 0.003


def agenda_recorrentes(
    ini: date,
    fim: date,
    receita_anual: float,
    base_mes: Callable[[pd.Period], float],
    recup: Callable[[], float],
) -> list[dict]:
    """Lançamentos datados entre `ini` e `fim`.

    `base_mes(p)` devolve o faturamento do mês `p` (base dos tributos do mês seguinte) e
    `recup()` o valor de "Recuperação de impostos" (aleatório no realizado, esperado na projeção).
    """
    linhas: list[dict] = []
    folha = receita_anual * FOLHA_SOBRE_RECEITA / 12

    def add(d, tipo, cat, sub, valor):
        if ini <= d <= fim:
            linhas.append(dict(data=d, tipo=tipo, categoria=cat, subcategoria=sub,
                               valor=round(float(valor), 2)))

    ano, mes = ini.year, ini.month
    while date(ano, mes, 1) <= fim:
        add(enesimo_dia_util(ano, mes, 5), "saida", "Pessoal", "Folha de pagamento", folha)
        add(proximo_dia_util(date(ano, mes, 7)), "saida", "Pessoal", "FGTS", folha * 0.08)
        add(anterior_dia_util(date(ano, mes, 20)), "saida", "Pessoal", "INSS", folha * 0.20)
        if mes == 11:
            add(anterior_dia_util(date(ano, 11, 30)), "saida", "Pessoal",
                "13º (1ª parcela)", folha * 0.5)
        if mes == 12:
            add(anterior_dia_util(date(ano, 12, 20)), "saida", "Pessoal",
                "13º (2ª parcela)", folha * 0.5)
        add(enesimo_dia_util(ano, mes, 5), "saida", "Ocupação", "Aluguel e condomínio", 180_000)
        dia10 = proximo_dia_util(date(ano, mes, 10))
        add(dia10, "saida", "Financeiras", "Dívida - amortização", 660_000)
        add(dia10, "saida", "Financeiras", "Dívida - juros", 440_000)
        base = float(base_mes(pd.Period(f"{ano}-{mes:02d}", "M") - 1))
        add(anterior_dia_util(date(ano, mes, 20)), "saida", "Tributos", "ICMS", base * ALIQ_ICMS)
        add(anterior_dia_util(date(ano, mes, 25)), "saida", "Tributos", "PIS/COFINS",
            base * ALIQ_PIS_COFINS)
        if mes in (1, 4, 7, 10):
            add(anterior_dia_util(date(ano, mes, 30)), "saida", "Tributos", "IRPJ/CSLL", 2_500_000)
        if mes in (3, 6, 9, 12):
            add(anterior_dia_util(date(ano, mes, 28)), "saida", "Sócios",
                "Distribuição de lucros", 3_000_000)
        add(enesimo_dia_util(ano, mes, 10), "entrada", "Outras entradas",
            "Recuperação de impostos", recup())
        ano, mes = (ano + (mes == 12), mes % 12 + 1)
    return linhas
