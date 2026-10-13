"""Clientes e fornecedores fictícios com perfis de pagamento distintos."""
import numpy as np
import pandas as pd

# share = fatia da receita; ticket = valor médio da NF; atraso_med = mediana de dias de atraso;
# default = probabilidade de a NF nunca ser paga
SEGMENTOS = {
    "grandes_contas": dict(n=15, share=0.45, ticket=400_000, sigma=0.4, prazo=(45, 60),
                           atraso_med=5, default=0.003),
    "atacado": dict(n=85, share=0.35, ticket=80_000, sigma=0.6, prazo=(30, 45),
                    atraso_med=8, default=0.015),
    "varejo": dict(n=200, share=0.20, ticket=15_000, sigma=0.7, prazo=(28, 35),
                   atraso_med=12, default=0.03),
}

CATEGORIAS_FORNECEDOR = {
    "Mercadorias para revenda": dict(n=60, peso=0.80),
    "Embalagens": dict(n=15, peso=0.06),
    "Frete e logística": dict(n=20, peso=0.10),
    "Serviços": dict(n=25, peso=0.04),
}
PRAZOS_FORNECEDOR = (30, 45, 60)


def gerar_clientes(rng: np.random.Generator) -> pd.DataFrame:
    linhas = []
    for seg, p in SEGMENTOS.items():
        pesos = rng.pareto(2.5, p["n"]) + 1
        pesos = pesos / pesos.sum()
        for i in range(p["n"]):
            linhas.append(dict(
                cliente_id=f"{seg[:3].upper()}{i + 1:03d}",
                nome=f"Cliente fictício {seg} {i + 1:03d}",
                segmento=seg,
                prazo=int(rng.integers(p["prazo"][0], p["prazo"][1] + 1)),
                fator_atraso=float(rng.lognormal(0, 0.3)),
                peso=float(pesos[i]),
            ))
    return pd.DataFrame(linhas)


def gerar_fornecedores(rng: np.random.Generator) -> pd.DataFrame:
    linhas = []
    for cat, p in CATEGORIAS_FORNECEDOR.items():
        for i in range(p["n"]):
            linhas.append(dict(
                fornecedor_id=f"{cat[:3].upper()}{i + 1:03d}",
                nome=f"Fornecedor fictício {cat} {i + 1:03d}",
                categoria=cat,
                prazo=int(rng.choice(PRAZOS_FORNECEDOR)),
            ))
    return pd.DataFrame(linhas)
