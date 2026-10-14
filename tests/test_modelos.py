from datetime import timedelta

import numpy as np
import pandas as pd
import pytest

from engine import safras as sf
from engine.calendario import Cal
from engine.modelos import previsao as pv
from engine.modelos.backtest import backtest_horizonte
from engine.modelos.pagamento import MAX_BD, ajustar_pag, amostrar_atraso, prob_pagar
from engine.sintetico.gerar import Config, gerar_empresa


@pytest.fixture(scope="module")
def emp():
    return gerar_empresa(Config())


@pytest.fixture(scope="module")
def cal(emp):
    c = emp.config.as_of
    return Cal(c - timedelta(days=1100), c + timedelta(days=600))


@pytest.fixture(scope="module")
def modelo(emp, cal):
    return pv.ajustar(emp.ar, emp.ap, emp.fluxo, emp.config.as_of, emp.config.receita_anual, cal)


@pytest.fixture(scope="module")
def estado(emp, cal):
    return pv.estado_em(emp.ar, emp.ap, emp.saldo, emp.config.as_of, cal)


# --- curva de pagamento ---------------------------------------------------------------------

def test_ajustar_pag_massa_total_e_perda():
    pag = ajustar_pag(np.array([0, 0, 1, 2, 2, 2]), n_total=8)
    assert pag.pmf.sum() + pag.p_perda == pytest.approx(1.0)
    assert pag.p_perda == pytest.approx(2 / 8)
    assert pag.surv[-1] == pytest.approx(pag.p_perda)


def test_prob_pagar_condicional_soma_um_menos_perda():
    pag = ajustar_pag(np.array([0, 1, 2, 3, 3]), n_total=6)  # p_perda = 1/6
    kd = np.arange(0, MAX_BD + 1)
    p = prob_pagar(pag, kd, np.full_like(kd, -1)).sum()
    assert p == pytest.approx(1 - pag.p_perda)
    # já atrasado 1 dia útil: só sobra a massa dos atrasos > 1, renormalizada
    p1 = prob_pagar(pag, kd, np.full_like(kd, 1)).sum()
    assert p1 == pytest.approx((1 - pag.p_perda - pag.cdf[1]) / pag.surv[1])
    assert prob_pagar(pag, 0, 1) == 0  # não pode pagar "no passado"


def test_amostragem_respeita_pmf_e_perda():
    pag = ajustar_pag(np.array([0] * 50 + [3] * 30), n_total=100)  # perda 20%
    u = np.random.default_rng(1).random(40_000)
    j = amostrar_atraso(pag, np.full(u.shape, -1), u)
    assert (j == 0).mean() == pytest.approx(0.5, abs=0.01)
    assert (j == 3).mean() == pytest.approx(0.3, abs=0.01)
    assert (j == -1).mean() == pytest.approx(0.2, abs=0.01)
    # condicional a já ter passado do dia 0: nunca sorteia atraso <= 0
    j2 = amostrar_atraso(pag, np.full(u.shape, 0), u)
    assert ((j2 == 3) | (j2 == -1)).all()


# --- modelo ajustado ------------------------------------------------------------------------

def test_curvas_refletem_perfis_dos_segmentos(modelo):
    mediana = {s: int(np.searchsorted(p.cdf, 0.5 * p.cdf[-1])) for s, p in modelo.ar_pag.items()}
    assert mediana["grandes_contas"] <= mediana["varejo"]
    assert modelo.ar_pag["varejo"].p_perda > modelo.ar_pag["grandes_contas"].p_perda
    assert modelo.ap_pag.p_perda < 0.01
    assert modelo.ap_categorias.sum() == pytest.approx(1.0)
    assert all(p.lam.shape == (12,) and (p.lam > 0).all() for p in modelo.ar_geracao.values())


def test_estado_so_tem_carteira_conhecida(estado, emp):
    assert len(estado.ar) > 0 and len(estado.ap) > 0
    assert not estado.ar.titulo_id.isin(emp.ar[emp.ar.status == "pago"].titulo_id).any()
    assert not estado.ar.titulo_id.isin(emp.ar[emp.ar.status == "inadimplente"].titulo_id).any()
    assert estado.saldo0 == pytest.approx(float(emp.saldo.iloc[-1]))


def test_esperado_diario_proximo_dia(modelo, estado, cal):
    esp = pv.esperado_diario(modelo, estado, np.array([estado.idx_o + 1]))
    assert (esp.valor >= 0).all()
    assert set(esp.tipo) == {"entrada", "saida"}
    assert esp[esp.tipo == "entrada"].valor.sum() > 1e5


def test_agenda_futura_tem_folha_no_quinto_dia_util(modelo, estado, emp, cal):
    emis = emp.ar.groupby(emp.ar.emissao.dt.to_period("M")).valor.sum()
    ag = pv.agenda_futura(modelo, estado, emis, cal, 65)
    folha = ag[ag.subcategoria == "Folha de pagamento"]
    assert len(folha) >= 3
    assert folha.valor.iloc[0] == pytest.approx(emp.config.receita_anual * 0.06 / 12)
    # tributos do mês seguinte usam faturamento esperado: ICMS > 0
    assert (ag[ag.subcategoria == "ICMS"].valor > 0).all()


# --- simulação ------------------------------------------------------------------------------

def test_simulacao_deterministica_e_plausivel(modelo, estado, emp, cal):
    emis = emp.ar.groupby(emp.ar.emissao.dt.to_period("M")).valor.sum()
    ag = pv.agenda_futura(modelo, estado, emis, cal, 65)
    e1, s1 = pv.simular(modelo, estado, ag, cal, 300, 5, 65)
    e2, s2 = pv.simular(modelo, estado, ag, cal, 300, 5, 65)
    assert e1.shape == (300, 65)
    np.testing.assert_array_equal(e1, e2)
    np.testing.assert_array_equal(s1, s2)
    receita_13s = emp.config.receita_anual * 65 / 252
    assert 0.8 * receita_13s < e1.sum(1).mean() < 1.2 * receita_13s
    r = pv.resumir(estado.saldo0, e1, s1, 15e6)
    p = r["quantis"]
    assert all(p["p10"][d] <= p["p50"][d] <= p["p90"][d] for d in range(65))
    assert len(r["p_abaixo_minimo"]) == 65
    assert 0.0 <= r["p_romper_no_horizonte"] <= 1.0
    assert r["cash_at_risk"] > 0


def test_resumir_sem_ruptura():
    ent = np.full((10, 5), 100.0)
    sai = np.zeros((10, 5))
    r = pv.resumir(1000.0, ent, sai, 0.0)
    assert r["p_romper_no_horizonte"] == 0 and r["primeira_ruptura_p50"] is None


# --- safras e backtest ------------------------------------------------------------------------

def test_safras_cobrem_o_realizado(emp, cal):
    i = cal.idx(emp.config.as_of)
    dias = [cal.data(k) for k in range(i - 19, i + 1)]
    m = pv.ajustar(emp.ar, emp.ap, emp.fluxo, cal.data(i - 20), emp.config.receita_anual, cal)
    s = sf.construir_safras(m, emp.ar, emp.ap, emp.fluxo, emp.saldo, dias, cal)
    real = emp.fluxo[emp.fluxo.data.isin(pd.to_datetime(dias))].valor.sum()
    assert s.realizado.sum() == pytest.approx(real)
    met = sf.metricas_diarias(s, emp.fluxo, cal)
    assert met["saida"]["wape_modelo"] < met["saida"]["wape_baseline"]


def test_baseline_media_passado_usa_mesmo_dia_util(emp, cal):
    b = sf.baseline_media_passado(emp.fluxo, emp.config.as_of, cal)
    assert b["entrada"] > 0 and b["saida"] > 0
    assert sf.wape(np.array([1.0, 2.0]), np.array([1.0, 4.0])) == pytest.approx(2 / 5)


def test_backtest_modelo_supera_media_do_passado(emp, cal):
    bt = backtest_horizonte(emp.ar, emp.ap, emp.fluxo, emp.saldo, emp.config.as_of,
                            emp.config.receita_anual, cal, 15e6, n_origens=4, n_caminhos=300)
    assert bt["saidas"]["wape_modelo"] < bt["saidas"]["wape_baseline"]
    assert bt["saldo"]["erro_relativo_modelo"] < bt["saldo"]["erro_relativo_baseline"]
    assert 0.5 < bt["cobertura"]["p10_p90"] <= 1.0
