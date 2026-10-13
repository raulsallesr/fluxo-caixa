/** Tipos do snapshot (espelham engine/snapshot.py, versão 1). */
export const VERSAO_SUPORTADA = 1;

export interface LinhaDiario {
  data: string;
  futuro: boolean;
  saldo_inicial: number;
  entradas_proj: number;
  entradas_real: number | null;
  saidas_proj: number;
  saidas_real: number | null;
  saldo_final_esperado: number;
  saldo_final_real: number | null;
}
export interface LinhaCategoria {
  data: string;
  tipo: "entrada" | "saida";
  categoria: string;
  subcategoria: string;
  projetado: number;
  realizado: number | null;
}
export interface TituloAR { id: string; cliente: string; segmento: string; venc_idx: number; valor: number }
export interface TituloAP { id: string; categoria: string; venc_idx: number; valor: number }
export interface CurvaPagamento { pmf: number[]; p_perda: number }
export interface Geracao { lam: number[]; ticket: number; sigma: number; prazos: number[]; pesos: number[] }
export interface ModeloSnapshot {
  ar_curva: Record<string, CurvaPagamento>;
  ar_geracao: Record<string, Geracao>;
  ap_curva: CurvaPagamento;
  ap_geracao: Geracao;
  ap_categorias: Record<string, number>;
}
export interface AgendaItem { data: string; idx: number; tipo: "entrada" | "saida"; categoria: string; subcategoria: string; valor: number }
export interface ProjecaoBase {
  n_caminhos: number;
  datas: string[];
  quantis: Record<string, number[]>;
  p_abaixo_minimo: number[];
  p_romper_no_horizonte: number;
  primeira_ruptura_p50: number | null;
  cash_at_risk: number;
}
export interface ErroWape { wape_modelo: number; wape_baseline: number }
export interface Backtest {
  n_origens: number;
  horizonte_semanas: number;
  origens: string[];
  entradas: ErroWape;
  saidas: ErroWape;
  saldo: {
    erro_medio_modelo: number;
    erro_medio_baseline: number;
    erro_relativo_modelo: number;
    erro_relativo_baseline: number;
  };
  cobertura: { p10_p90: number; p5_p95: number };
  diario: { entrada: ErroWape; saida: ErroWape };
}
export interface Snapshot {
  versao: number;
  empresa: string;
  gerado_em: string;
  as_of: string;
  caixa_minimo: number;
  horizonte: number;
  calendario: string[];
  idx_origem: number;
  saldo_historico: [string, number][];
  diario: LinhaDiario[];
  categorias: LinhaCategoria[];
  titulos_ar: TituloAR[];
  titulos_ap: TituloAP[];
  agenda: AgendaItem[];
  modelo: ModeloSnapshot;
  projecao_base: ProjecaoBase;
  backtest: Backtest;
}
