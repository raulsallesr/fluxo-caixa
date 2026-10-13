"""Schema do snapshot JSON consumido pelo web app (versionado e validado com pydantic)."""
from pydantic import BaseModel, Field

VERSAO = 1


class LinhaDiario(BaseModel):
    data: str
    futuro: bool
    saldo_inicial: float
    entradas_proj: float
    entradas_real: float | None
    saidas_proj: float
    saidas_real: float | None
    saldo_final_esperado: float
    saldo_final_real: float | None


class LinhaCategoria(BaseModel):
    data: str
    tipo: str
    categoria: str
    subcategoria: str
    projetado: float
    realizado: float | None


class TituloAR(BaseModel):
    id: str
    cliente: str
    segmento: str
    venc_idx: int
    valor: float


class TituloAP(BaseModel):
    id: str
    categoria: str
    venc_idx: int
    valor: float


class CurvaPagamento(BaseModel):
    """P(atraso = k dias úteis) para k = 0..90; o resto da massa é perda."""

    pmf: list[float]
    p_perda: float


class Geracao(BaseModel):
    """Faturas/compras futuras: Poisson sazonal por dia útil + valor lognormal + prazo."""

    lam: list[float] = Field(description="intensidade por dia útil, jan..dez")
    ticket: float
    sigma: float
    prazos: list[int]
    pesos: list[float]


class ModeloSnapshot(BaseModel):
    ar_curva: dict[str, CurvaPagamento]
    ar_geracao: dict[str, Geracao]
    ap_curva: CurvaPagamento
    ap_geracao: Geracao
    ap_categorias: dict[str, float]


class AgendaItem(BaseModel):
    data: str
    idx: int
    tipo: str
    categoria: str
    subcategoria: str
    valor: float


class ProjecaoBase(BaseModel):
    n_caminhos: int
    datas: list[str]
    quantis: dict[str, list[float]]
    p_abaixo_minimo: list[float]
    p_romper_no_horizonte: float
    primeira_ruptura_p50: int | None
    cash_at_risk: float


class Snapshot(BaseModel):
    versao: int = VERSAO
    empresa: str
    gerado_em: str
    as_of: str
    caixa_minimo: float
    horizonte: int
    calendario: list[str] = Field(description="dias úteis consecutivos; idx = posição aqui")
    idx_origem: int
    saldo_historico: list[tuple[str, float]]
    diario: list[LinhaDiario]
    categorias: list[LinhaCategoria]
    titulos_ar: list[TituloAR]
    titulos_ap: list[TituloAP]
    agenda: list[AgendaItem]
    modelo: ModeloSnapshot
    projecao_base: ProjecaoBase
    backtest: dict
