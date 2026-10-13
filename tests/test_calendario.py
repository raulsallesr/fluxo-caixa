from datetime import date

from engine.calendario import eh_dia_util, enesimo_dia_util, proximo_dia_util


def test_feriado_e_fim_de_semana_nao_sao_uteis():
    assert not eh_dia_util(date(2026, 12, 25))
    assert not eh_dia_util(date(2026, 10, 17))  # sábado
    assert eh_dia_util(date(2026, 10, 13))


def test_proximo_dia_util_pula_fim_de_semana():
    assert proximo_dia_util(date(2026, 10, 17)) == date(2026, 10, 19)


def test_quinto_dia_util():
    # out/2026: 1(qui) 2(sex) 5 6 7 -> 5º dia útil = 7
    assert enesimo_dia_util(2026, 10, 5) == date(2026, 10, 7)
