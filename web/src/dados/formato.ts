/** Formatação pt-BR e métricas simples. Ausência de dado = "—", nunca zero. */
export const TRACO = "—";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** R$ 1.234.567 */
export function fmtBRL(v: number | null | undefined): string {
  return ok(v) ? brl.format(Math.round(v)).replace(/ /g, " ") : TRACO;
}
/** R$ 12,3 mi */
export function fmtMi(v: number | null | undefined, casas = 1): string {
  if (!ok(v)) return TRACO;
  const f = casas === 2 ? num2 : num1;
  return `R$ ${f.format(v / 1e6)} mi`;
}
/** Valor em milhões sem prefixo (eixos). */
export function fmtMiCurto(v: number): string {
  return num1.format(v / 1e6);
}
export function fmtPct(v: number | null | undefined, casas = 1): string {
  if (!ok(v)) return TRACO;
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v * 100)}%`;
}
/** Diferença com sinal: +R$ 1,2 mi */
export function fmtDeltaMi(v: number | null | undefined): string {
  if (!ok(v)) return TRACO;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}R$ ${num1.format(Math.abs(v) / 1e6)} mi`;
}
export function fmtDeltaPP(v: number | null | undefined): string {
  if (!ok(v)) return TRACO;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${num1.format(Math.abs(v) * 100)} p.p.`;
}
/** 2026-10-13 -> 13/10/2026 */
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return TRACO;
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
export function fmtDataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function diaSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** WAPE = Σ|real − previsto| / Σ|real|. Retorna null sem base (soma real = 0). */
export function wape(real: number[], previsto: number[]): number | null {
  if (real.length !== previsto.length || real.length === 0) return null;
  let num = 0;
  let den = 0;
  for (let i = 0; i < real.length; i++) {
    num += Math.abs(real[i] - previsto[i]);
    den += Math.abs(real[i]);
  }
  return den === 0 ? null : num / den;
}

/** Quantil por interpolação linear (igual ao numpy.percentile padrão); q em [0,100]. */
export function quantil(ordenado: ArrayLike<number>, q: number): number {
  const n = ordenado.length;
  if (n === 0) return NaN;
  const pos = ((n - 1) * q) / 100;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, n - 1);
  return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (pos - lo);
}
