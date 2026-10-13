import numpy as np
import pandas as pd
import pytest

from engine.sintetico.gerar import Config, gerar_empresa


@pytest.fixture(scope="module")
def emp():
    return gerar_empresa(Config())


def test_deterministico():
    a = gerar_empresa(Config(seed=7, dias_historico=200))
    b = gerar_empresa(Config(seed=7, dias_historico=200))
    pd.testing.assert_frame_equal(a.fluxo, b.fluxo)


def test_receita_anual_na_faixa_alvo(emp):
    ar = emp.ar
    ult = ar[ar.emissao > ar.emissao.max() - pd.Timedelta(days=365)]
    assert 280e6 < ult.valor.sum() < 420e6


def test_dso_e_dpo_plausiveis(emp):
    pagos = emp.ar[emp.ar.status == "pago"]
    dso = (pagos.pagamento - pagos.emissao).dt.days.mean()
    assert 35 < dso < 75
    ap = emp.ap[emp.ap.status == "pago"]
    dpo = (ap.pagamento - ap.emissao).dt.days.mean()
    assert 35 < dpo < 65


def test_sazonalidade_fim_de_ano(emp):
    ar = emp.ar[emp.ar.emissao >= emp.ar.emissao.max() - pd.Timedelta(days=700)]
    mensal = ar.groupby(ar.emissao.dt.month).valor.sum()
    assert mensal[11] > mensal[2] * 1.05


def test_sem_vazamento_do_futuro(emp):
    asof = pd.Timestamp(emp.config.as_of)
    assert emp.ar.pagamento.dropna().max() <= asof
    assert emp.ap.pagamento.dropna().max() <= asof
    assert emp.fluxo.data.max() <= asof
    abertos = emp.ar[emp.ar.status == "aberto"]
    assert abertos.pagamento.isna().all() and len(abertos) > 0


def test_pagamentos_em_dia_util(emp):
    assert (emp.fluxo.data.dt.weekday < 5).all()


def test_caixa_oscila_sem_estourar(emp):
    assert emp.saldo.min() > 0
    assert emp.saldo.max() < 80e6


def test_perfis_de_atraso_diferentes_por_segmento(emp):
    pagos = emp.ar[emp.ar.status == "pago"]
    atraso = (pagos.pagamento - pagos.vencimento).dt.days
    med = atraso.groupby(pagos.segmento).median()
    assert med["grandes_contas"] < med["varejo"]
    assert np.isfinite(med).all()
