import json
from itertools import pairwise

import pytest

from engine.exportar import gravar, montar_snapshot
from engine.snapshot import VERSAO, Snapshot


@pytest.fixture(scope="module")
def snap():
    return montar_snapshot(n_caminhos=300, n_origens=2)


def test_snapshot_valido_e_consistente(snap):
    assert snap.versao == VERSAO
    assert len(snap.diario) == 100 and sum(d.futuro for d in snap.diario) == 10
    passado = [d for d in snap.diario if not d.futuro]
    assert all(d.entradas_real is not None and d.saldo_final_real is not None for d in passado)
    # saldo inicial de um dia = saldo final real do anterior
    for a, b in pairwise(passado):
        assert b.saldo_inicial == pytest.approx(a.saldo_final_real, abs=1.0)
    assert snap.calendario[snap.idx_origem] == snap.as_of
    assert all(0 <= t.venc_idx < len(snap.calendario) for t in snap.titulos_ar + snap.titulos_ap)
    assert len(snap.projecao_base.datas) == snap.horizonte
    assert len(snap.projecao_base.quantis["p50"]) == snap.horizonte


def test_futuro_nao_tem_realizado(snap):
    fut = [c for c in snap.categorias if c.data > snap.as_of]
    assert fut and all(c.realizado is None for c in fut)


def test_gravar_gera_json_sem_nan(tmp_path):
    destino = tmp_path / "s.json"
    gravar(destino, n_caminhos=200, n_origens=1)
    bruto = destino.read_text(encoding="utf-8")
    assert "NaN" not in bruto
    s = Snapshot.model_validate(json.loads(bruto))
    assert s.empresa.endswith("(fictícia)")
