/** Alavancas do simulador what-if e sua serialização em query string. */
export interface Alavancas {
  /** Atraso adicional dos clientes, em dias úteis (geral). */
  atrasoGeral: number;
  /** Atraso adicional por segmento (somado ao geral). */
  atrasoSeg: Record<string, number>;
  /** Inadimplência adicional, em pontos percentuais (somada ao p_perda de cada segmento). */
  inadimplenciaPP: number;
  /** Choque nas vendas futuras, em % (escala a intensidade lam das faturas). */
  vendasPct: number;
  /** Prorrogação de pagamento a fornecedores, em dias úteis. */
  fornecedoresDU: number;
  /** Antecipação de recebíveis: valor de face (R$) e taxa a.m. (%). */
  antecipacaoValor: number;
  antecipacaoTaxaAM: number;
  /** Captação: valor (R$), dia útil do horizonte (1..h) de entrada, taxa a.m. (%) e prazo em dias úteis. */
  captacaoValor: number;
  captacaoDia: number;
  captacaoTaxaAM: number;
  captacaoPrazoDU: number;
  /** Postergação de despesa: valor (R$), dia útil original (1..h) e dias úteis adiados. */
  posterValor: number;
  posterDia: number;
  posterDias: number;
  /** Caixa mínimo (R$). */
  caixaMinimo: number;
}

export const SEGMENTOS_PADRAO = ["atacado", "grandes_contas", "varejo"];

export function alavancasBase(caixaMinimo: number): Alavancas {
  return {
    atrasoGeral: 0,
    atrasoSeg: {},
    inadimplenciaPP: 0,
    vendasPct: 0,
    fornecedoresDU: 0,
    antecipacaoValor: 0,
    antecipacaoTaxaAM: 2.0,
    captacaoValor: 0,
    captacaoDia: 1,
    captacaoTaxaAM: 1.8,
    captacaoPrazoDU: 42,
    posterValor: 0,
    posterDia: 1,
    posterDias: 10,
    caixaMinimo,
  };
}

const ESCALARES: (keyof Omit<Alavancas, "atrasoSeg">)[] = [
  "atrasoGeral", "inadimplenciaPP", "vendasPct", "fornecedoresDU", "antecipacaoValor",
  "antecipacaoTaxaAM", "captacaoValor", "captacaoDia", "captacaoTaxaAM", "captacaoPrazoDU",
  "posterValor", "posterDia", "posterDias", "caixaMinimo",
];
const ABREV: Record<string, string> = {
  atrasoGeral: "ag", inadimplenciaPP: "ip", vendasPct: "vp", fornecedoresDU: "fd",
  antecipacaoValor: "av", antecipacaoTaxaAM: "at", captacaoValor: "cv", captacaoDia: "cd",
  captacaoTaxaAM: "ct", captacaoPrazoDU: "cp", posterValor: "pv", posterDia: "pd",
  posterDias: "pn", caixaMinimo: "cm",
};

/** Serializa só o que difere da base (link curto e compartilhável). */
export function alavancasParaQuery(a: Alavancas, base: Alavancas): string {
  const p = new URLSearchParams();
  for (const k of ESCALARES) if (a[k] !== base[k]) p.set(ABREV[k], String(a[k]));
  for (const [seg, v] of Object.entries(a.atrasoSeg)) if (v) p.set(`as_${seg}`, String(v));
  return p.toString();
}

export function alavancasDeQuery(q: string, base: Alavancas): Alavancas {
  const p = new URLSearchParams(q);
  const a: Alavancas = { ...base, atrasoSeg: {} };
  for (const k of ESCALARES) {
    const v = p.get(ABREV[k]);
    if (v !== null && v.trim() !== "" && Number.isFinite(Number(v))) (a[k] as number) = Number(v);
  }
  for (const [chave, v] of p.entries()) {
    if (chave.startsWith("as_") && Number.isFinite(Number(v))) a.atrasoSeg[chave.slice(3)] = Number(v);
  }
  return a;
}

export function ehBase(a: Alavancas, base: Alavancas): boolean {
  return alavancasParaQuery(a, base) === "";
}
