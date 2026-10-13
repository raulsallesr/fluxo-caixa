from datetime import date

import numpy as np

from engine.calendario import (
    ajustar_dia_util,
    anterior_dia_util,
    dias_uteis,
    eh_dia_util,
    enesimo_dia_util,
    proximo_dia_util,
)


def test_feriado_e_fim_de_semana_nao_sao_uteis():
    assert not eh_dia_util(date(2026, 12, 25))
    assert not eh_dia_util(date(2026, 10, 17))  # sábado
    assert eh_dia_util(date(2026, 10, 13))


def test_proximo_dia_util_pula_fim_de_semana():
    assert proximo_dia_util(date(2026, 10, 17)) == date(2026, 10, 19)


def test_quinto_dia_util():
    # out/2026: 1(qui) 2(sex) 5 6 7 -> 5º dia útil = 7
    assert enesimo_dia_util(2026, 10, 5) == date(2026, 10, 7)


def test_anterior_dia_util():
    assert anterior_dia_util(date(2026, 10, 17)) == date(2026, 10, 16)


def test_dias_uteis_e_ajuste():
    uteis = dias_uteis(date(2026, 10, 1), date(2026, 10, 31))
    assert len(uteis) == 21  # out/2026: 22 dias de semana menos 12/10
    sab = np.array([np.datetime64("2026-10-17")])
    assert ajustar_dia_util(sab, uteis)[0] == np.datetime64("2026-10-19")
