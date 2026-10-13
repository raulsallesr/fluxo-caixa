/**
 * Monte Carlo do saldo de caixa — porte de engine/modelos/previsao.py::simular
 * (+ pagamento.py: amostragem condicional do atraso em dias úteis).
 *
 * Índices (venc_idx, idx_origem) são relativos a `calendario` do snapshot;
 * o primeiro dia futuro é idx_origem + 1.
 */
import type { Geracao, Snapshot } from "../dados/tipos";
import { quantil } from "../dados/formato";
import { Alavancas, alavancasBase } from "./alavancas";
import { Rng } from "./rng";

export const MAX_BD = 90;
export const DU_POR_MES = 21;
export const QUANTIS = [5, 10, 25, 50, 75, 90, 95] as const;

export type DadosSim = Pick<
  Snapshot,
  "calendario" | "idx_origem" | "horizonte" | "caixa_minimo" | "titulos_ar" | "titulos_ap" | "agenda" | "modelo"
> & { saldo0: number };

export interface ParamsSim {
  n: number;
  seed: number;
  alavancas?: Alavancas;
}

export interface CustosCenario {
  antecipacao: { face: number; caixa: number; custo: number };
  captacao: { valor: number; juros: number };
}

export interface ResultadoSim {
  n: number;
  horizonte: number;
  caixa_minimo: number;
  quantis: Record<string, number[]>;
  p_abaixo_minimo: number[];
  p_romper_no_horizonte: number;
  primeira_ruptura_p50: number | null;
  cash_at_risk: number;
  /** Médias por dia (entre caminhos) de entradas/saídas operacionais e fluxo financeiro do cenário. */
  entradas_medias: number[];
  saidas_medias: number[];
  fluxo_financeiro: number[];
  custos: CustosCenario;
}

/** Extrai do snapshot só o que o simulador precisa (saldo0 = último saldo real). */
export function dadosDoSnapshot(s: Snapshot): DadosSim {
  const reais = s.diario.filter((l) => !l.futuro && l.saldo_final_real !== null);
  const saldo0 = reais[reais.length - 1]?.saldo_final_real;
  if (saldo0 === undefined || saldo0 === null) throw new Error("Snapshot sem saldo real.");
  return {
    calendario: s.calendario,
    idx_origem: s.idx_origem,
    horizonte: s.horizonte,
    caixa_minimo: s.caixa_minimo,
    titulos_ar: s.titulos_ar,
    titulos_ap: s.titulos_ap,
    agenda: s.agenda,
    modelo: s.modelo,
    saldo0,
  };
}

// ---------- calendário ----------
const diaEpoch = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);

/** Primeiro índice i com v[i] >= x (searchsorted 'left'); limitado ao último índice. */
function lowerBound(v: Int32Array, x: number): number {
  let lo = 0;
  let hi = v.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (v[m] < x) lo = m + 1;
    else hi = m;
  }
  return Math.min(lo, v.length - 1);
}

// ---------- curva de pagamento ----------
export interface CurvaPreparada {
  cdf: Float64Array; // k = 0..MAX_BD
  ultimo: number;
}

/** Soma `pp` pontos percentuais ao p_perda e renormaliza a pmf (massa total = 1 − p_perda). */
export function prepararCurva(pmf: number[], pPerda: number, pp = 0): CurvaPreparada {
  const novoPerda = Math.min(Math.max(pPerda + pp / 100, 0), 0.999);
  const fator = pp === 0 || pPerda >= 1 ? 1 : (1 - novoPerda) / (1 - pPerda);
  const cdf = new Float64Array(MAX_BD + 1);
  let acc = 0;
  for (let k = 0; k <= MAX_BD; k++) {
    acc += (pmf[k] ?? 0) * fator;
    cdf[k] = acc;
  }
  return { cdf, ultimo: acc };
}

/** Atraso sorteado (dias úteis) dado não pago até `ko`; −1 = nunca paga (pagamento.py::amostrar_atraso). */
export function amostrarAtraso(c: CurvaPreparada, ko: number, u: number): number {
  const cdf = c.cdf;
  const cdfO = ko < 0 ? 0 : cdf[Math.min(ko, MAX_BD)];
  const alvo = cdfO + u * (1 - cdfO);
  if (alvo >= c.ultimo) return -1;
  // searchsorted(cdf, alvo, side="right"): primeiro j com cdf[j] > alvo
  let lo = 0;
  let hi = MAX_BD + 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (cdf[m] <= alvo) lo = m + 1;
    else hi = m;
  }
  return Math.max(lo, ko + 1);
}

/** P(pagar com atraso kd | ainda não pago ao fim do dia de atraso ko) — pagamento.py::prob_pagar. */
export function probPagar(pmf: number[], kd: number, ko: number): number {
  if (!(kd >= 0 && kd <= MAX_BD && kd > ko)) return 0;
  let surv = 1;
  if (ko >= 0) {
    let c = 0;
    for (let k = 0; k <= Math.min(ko, MAX_BD); k++) c += pmf[k];
    surv = 1 - c;
  }
  return pmf[kd] / Math.max(surv, 1e-9);
}

// ---------- geração de faturas futuras ----------
interface GeracaoPreparada {
  lam: Float64Array; // por dia do horizonte (já escalada)
  ticket: number;
  sigma: number;
  cumPesos: Float64Array;
  /** vencIdx[e * nPrazos + p] */
  vencIdx: Int32Array;
  nPrazos: number;
  curva: CurvaPreparada;
  shift: number;
}

function prepararGeracao(
  g: Geracao,
  curva: CurvaPreparada,
  shift: number,
  escalaLam: number,
  h: number,
  idx0: number,
  epoch: Int32Array,
  mesCal: Uint8Array,
): GeracaoPreparada {
  const lam = new Float64Array(h);
  const nPrazos = g.prazos.length;
  const vencIdx = new Int32Array(h * nPrazos);
  for (let e = 0; e < h; e++) {
    lam[e] = g.lam[mesCal[idx0 + e]] * escalaLam;
    for (let p = 0; p < nPrazos; p++) vencIdx[e * nPrazos + p] = lowerBound(epoch, epoch[idx0 + e] + g.prazos[p]);
  }
  const tot = g.pesos.reduce((x, y) => x + y, 0);
  const cum = new Float64Array(nPrazos);
  let acc = 0;
  for (let p = 0; p < nPrazos; p++) {
    acc += g.pesos[p] / tot;
    cum[p] = acc;
  }
  return { lam, ticket: g.ticket, sigma: g.sigma, cumPesos: cum, vencIdx, nPrazos, curva, shift };
}

// ---------- cenário determinístico ----------
export interface Deterministico {
  entAgenda: Float64Array;
  saiAgenda: Float64Array;
  financeiro: Float64Array;
  /** Fração vendida (antecipada) de cada título AR aberto, na ordem de titulos_ar. */
  vendidoAR: Float64Array;
  custos: CustosCenario;
}

export function construirDeterministico(d: DadosSim, a: Alavancas): Deterministico {
  const h = d.horizonte;
  const idx0 = d.idx_origem + 1;
  const ent = new Float64Array(h);
  const sai = new Float64Array(h);
  const fin = new Float64Array(h);
  for (const it of d.agenda) {
    const k = it.idx - idx0;
    if (k >= 0 && k < h) (it.tipo === "entrada" ? ent : sai)[k] += it.valor;
  }
  const vendido = new Float64Array(d.titulos_ar.length);
  const custos: CustosCenario = {
    antecipacao: { face: 0, caixa: 0, custo: 0 },
    captacao: { valor: 0, juros: 0 },
  };
  // antecipação: vende os AR de maior vencimento até somar o valor de face
  if (a.antecipacaoValor > 0) {
    const ordem = d.titulos_ar.map((_, i) => i).sort((i, j) => d.titulos_ar[j].venc_idx - d.titulos_ar[i].venc_idx);
    let falta = a.antecipacaoValor;
    let caixa = 0;
    for (const i of ordem) {
      if (falta <= 0) break;
      const t = d.titulos_ar[i];
      const parte = Math.min(t.valor, falta);
      vendido[i] = parte / t.valor;
      falta -= parte;
      const meses = Math.max(t.venc_idx - d.idx_origem, 1) / DU_POR_MES;
      caixa += parte / Math.pow(1 + a.antecipacaoTaxaAM / 100, meses);
    }
    const face = a.antecipacaoValor - Math.max(falta, 0);
    fin[0] += caixa;
    custos.antecipacao = { face, caixa, custo: face - caixa };
  }
  // captação: entra no dia, paga principal + juros compostos no vencimento
  if (a.captacaoValor > 0) {
    const dia = Math.min(Math.max(Math.round(a.captacaoDia), 1), h) - 1;
    const juros = a.captacaoValor * (Math.pow(1 + a.captacaoTaxaAM / 100, a.captacaoPrazoDU / DU_POR_MES) - 1);
    fin[dia] += a.captacaoValor;
    const venc = dia + Math.max(Math.round(a.captacaoPrazoDU), 1);
    if (venc < h) fin[venc] -= a.captacaoValor + juros;
    custos.captacao = { valor: a.captacaoValor, juros };
  }
  // postergação: a despesa deixa de sair no dia original e sai `posterDias` depois
  if (a.posterValor > 0 && a.posterDias > 0) {
    const dia = Math.min(Math.max(Math.round(a.posterDia), 1), h) - 1;
    fin[dia] += a.posterValor;
    const novo = dia + Math.round(a.posterDias);
    if (novo < h) fin[novo] -= a.posterValor;
  }
  return { entAgenda: ent, saiAgenda: sai, financeiro: fin, vendidoAR: vendido, custos };
}

// ---------- simulação ----------
interface Aberto {
  venc: number;
  valor: number;
  ko: number;
}

export function simular(d: DadosSim, p: ParamsSim): ResultadoSim {
  const a = p.alavancas ?? alavancasBase(d.caixa_minimo);
  const n = p.n;
  const h = d.horizonte;
  const idxO = d.idx_origem;
  const idx0 = idxO + 1;
  const rng = new Rng(p.seed);

  const epoch = Int32Array.from(d.calendario.map(diaEpoch));
  const mesCal = Uint8Array.from(d.calendario.map((s) => Number(s.slice(5, 7)) - 1));
  const det = construirDeterministico(d, a);

  // curvas e geração por segmento
  const segmentos = Object.keys(d.modelo.ar_curva);
  const arCurva = new Map<string, CurvaPreparada>();
  const arShift = new Map<string, number>();
  const arGer = new Map<string, GeracaoPreparada>();
  for (const seg of segmentos) {
    const c = d.modelo.ar_curva[seg];
    const curva = prepararCurva(c.pmf, c.p_perda, a.inadimplenciaPP);
    const shift = Math.round(a.atrasoGeral + (a.atrasoSeg[seg] ?? 0));
    arCurva.set(seg, curva);
    arShift.set(seg, shift);
    arGer.set(seg, prepararGeracao(d.modelo.ar_geracao[seg], curva, shift, 1 + a.vendasPct / 100, h, idx0, epoch, mesCal));
  }
  const apCurva = prepararCurva(d.modelo.ap_curva.pmf, d.modelo.ap_curva.p_perda, 0);
  const shiftAP = Math.round(a.fornecedoresDU);
  const apGer = prepararGeracao(d.modelo.ap_geracao, apCurva, shiftAP, 1, h, idx0, epoch, mesCal);

  // títulos abertos (valor efetivo após antecipação)
  const abertosAR = new Map<string, Aberto[]>();
  segmentos.forEach((s) => abertosAR.set(s, []));
  d.titulos_ar.forEach((t, i) => {
    const v = t.valor * (1 - det.vendidoAR[i]);
    if (v > 0) abertosAR.get(t.segmento)?.push({ venc: t.venc_idx, valor: v, ko: idxO - t.venc_idx });
  });
  const abertosAP: Aberto[] = d.titulos_ap.map((t) => ({ venc: t.venc_idx, valor: t.valor, ko: idxO - t.venc_idx }));

  const saldo = new Float64Array(h * n); // day-major: saldo[k * n + caminho]
  const minPath = new Float64Array(n);
  const primeira = new Int32Array(n);
  const somaEnt = new Float64Array(h);
  const somaSai = new Float64Array(h);
  const ent = new Float64Array(h);
  const sai = new Float64Array(h);
  const minimo = a.caixaMinimo;

  const acumulaAbertos = (alvo: Float64Array, ts: Aberto[], curva: CurvaPreparada, shift: number) => {
    for (const t of ts) {
      const j = amostrarAtraso(curva, t.ko, rng.uniforme());
      if (j < 0) continue;
      const k = t.venc + j + shift - idx0;
      if (k >= 0 && k < h) alvo[k] += t.valor;
    }
  };
  const acumulaNovos = (alvo: Float64Array, g: GeracaoPreparada) => {
    const mu = (-g.sigma * g.sigma) / 2;
    for (let e = 0; e < h; e++) {
      const cont = rng.poisson(g.lam[e]);
      for (let c = 0; c < cont; c++) {
        const valor = g.ticket * rng.lognormal(mu, g.sigma);
        const u = rng.uniforme();
        let pi = 0;
        while (pi < g.nPrazos - 1 && g.cumPesos[pi] <= u) pi++;
        const j = amostrarAtraso(g.curva, -1, rng.uniforme());
        if (j < 0) continue;
        const k = g.vencIdx[e * g.nPrazos + pi] + j + g.shift - idx0;
        if (k >= 0 && k < h) alvo[k] += valor;
      }
    }
  };

  for (let c = 0; c < n; c++) {
    ent.fill(0);
    sai.fill(0);
    for (const seg of segmentos) {
      acumulaAbertos(ent, abertosAR.get(seg)!, arCurva.get(seg)!, arShift.get(seg)!);
      acumulaNovos(ent, arGer.get(seg)!);
    }
    acumulaAbertos(sai, abertosAP, apCurva, shiftAP);
    acumulaNovos(sai, apGer);
    let s = d.saldo0;
    let mn = Infinity;
    let prim = -1;
    for (let k = 0; k < h; k++) {
      const e = ent[k] + det.entAgenda[k];
      const so = sai[k] + det.saiAgenda[k];
      somaEnt[k] += e;
      somaSai[k] += so;
      s += e - so + det.financeiro[k];
      saldo[k * n + c] = s;
      if (s < mn) mn = s;
      if (prim < 0 && s < minimo) prim = k;
    }
    minPath[c] = mn;
    primeira[c] = prim;
  }

  // resumo (previsao.py::resumir)
  const quantis: Record<string, number[]> = {};
  QUANTIS.forEach((q) => (quantis[`p${q}`] = new Array<number>(h)));
  const pAbaixo = new Array<number>(h);
  for (let k = 0; k < h; k++) {
    const fatia = saldo.slice(k * n, (k + 1) * n);
    let abaixo = 0;
    for (let c = 0; c < n; c++) if (fatia[c] < minimo) abaixo++;
    pAbaixo[k] = abaixo / n;
    fatia.sort();
    for (const q of QUANTIS) quantis[`p${q}`][k] = quantil(fatia, q);
  }
  const rupt: number[] = [];
  for (let c = 0; c < n; c++) if (primeira[c] >= 0) rupt.push(primeira[c]);
  rupt.sort((x, y) => x - y);
  const mins = Float64Array.from(minPath).sort();
  return {
    n,
    horizonte: h,
    caixa_minimo: minimo,
    quantis,
    p_abaixo_minimo: pAbaixo,
    p_romper_no_horizonte: rupt.length / n,
    primeira_ruptura_p50: rupt.length ? Math.trunc(quantil(rupt, 50)) : null,
    cash_at_risk: d.saldo0 - quantil(mins, 5),
    entradas_medias: Array.from(somaEnt, (x) => x / n),
    saidas_medias: Array.from(somaSai, (x) => x / n),
    fluxo_financeiro: Array.from(det.financeiro),
    custos: det.custos,
  };
}

/** Primeiro índice do horizonte em que `p[k] > limiar` (ou null). */
export function primeiroDiaAcima(p: number[], limiar: number): number | null {
  const i = p.findIndex((x) => x > limiar);
  return i < 0 ? null : i;
}
