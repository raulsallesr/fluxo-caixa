"""Curva de pagamento: distribuição do atraso (em dias úteis) e probabilidade de perda."""
from dataclasses import dataclass

import numpy as np

MAX_BD = 90


@dataclass(frozen=True)
class Pag:
    pmf: np.ndarray  # P(atraso = k dias úteis), k = 0..MAX_BD
    p_perda: float  # P(nunca paga)

    @property
    def cdf(self) -> np.ndarray:
        return np.cumsum(self.pmf)

    @property
    def surv(self) -> np.ndarray:
        """P(ainda não pago ao fim do dia k) = P(atraso > k) + P(perda)."""
        return 1.0 - self.cdf


def ajustar_pag(atrasos_bd: np.ndarray, n_total: int) -> Pag:
    """Ajusta a curva a partir dos atrasos observados; `n_total` inclui títulos nunca pagos."""
    a = np.asarray(atrasos_bd)
    a = a[(a >= 0) & (a <= MAX_BD)]
    pmf = np.bincount(a, minlength=MAX_BD + 1).astype(float) / max(n_total, 1)
    return Pag(pmf=pmf, p_perda=float(max(1.0 - pmf.sum(), 0.0)))


def prob_pagar(pag: Pag, kd, ko) -> np.ndarray:
    """P(pagar com atraso kd | ainda não pago ao fim do dia de atraso ko). ko<0 = não vencido."""
    kd = np.asarray(kd)
    ko = np.asarray(ko)
    pm = np.where((kd >= 0) & (kd <= MAX_BD) & (kd > ko), pag.pmf[np.clip(kd, 0, MAX_BD)], 0.0)
    so = np.where(ko < 0, 1.0, pag.surv[np.clip(ko, 0, MAX_BD)])
    return pm / np.maximum(so, 1e-9)


def amostrar_atraso(pag: Pag, ko: np.ndarray, u: np.ndarray) -> np.ndarray:
    """Atraso sorteado (dias úteis) dado não pago até `ko`; -1 = nunca paga."""
    cdf = pag.cdf
    ko = np.asarray(ko)
    cdf_o = np.where(ko < 0, 0.0, cdf[np.clip(ko, 0, MAX_BD)])
    so = 1.0 - cdf_o
    alvo = cdf_o + u * so
    j = np.searchsorted(cdf, alvo, side="right")
    return np.where(alvo >= cdf[-1], -1, np.maximum(j, ko + 1))
