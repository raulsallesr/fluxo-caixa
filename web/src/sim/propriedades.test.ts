import { describe, expect, it } from "vitest";
import { alavancasBase, alavancasDeQuery, alavancasParaQuery } from "./alavancas";
import { Rng } from "./rng";
import { dadosDoSnapshot, simular } from "./simulador";
import { lerSnapshot } from "./helpers.test-util";

const snap = lerSnapshot();
const dados = dadosDoSnapshot(snap);
const base = alavancasBase(snap.caixa_minimo);
const N = 800;
const rodar = (patch: Partial<typeof base> = {}) =>
  simular(dados, { n: N, seed: 7, alavancas: { ...base, ...patch } });
const soma = (v: number[]) => v.reduce((a, b) => a + b, 0);

describe("propriedades do simulador", () => {
  const ref = rodar();

  it("seed fixa é determinística", () => {
    const b = rodar();
    expect(b.quantis.p50).toEqual(ref.quantis.p50);
    expect(b.p_abaixo_minimo).toEqual(ref.p_abaixo_minimo);
  });
  it("seeds diferentes dão resultados diferentes", () => {
    const b = simular(dados, { n: N, seed: 8, alavancas: base });
    expect(b.quantis.p50).not.toEqual(ref.quantis.p50);
  });
  it("quantis são monotônicos", () => {
    for (let k = 0; k < ref.horizonte; k++) {
      const q = ["p5", "p10", "p25", "p50", "p75", "p90", "p95"].map((n) => ref.quantis[n][k]);
      for (let i = 1; i < q.length; i++) expect(q[i]).toBeGreaterThanOrEqual(q[i - 1]);
    }
  });
  it("atraso maior => saldo mediano no meio do horizonte menor ou igual", () => {
    const r = rodar({ atrasoGeral: 8 });
    const meio = 30;
    expect(r.quantis.p50[meio]).toBeLessThanOrEqual(ref.quantis.p50[meio]);
    expect(r.p_romper_no_horizonte).toBeGreaterThanOrEqual(ref.p_romper_no_horizonte - 0.02);
  });
  it("inadimplência maior => menos entradas", () => {
    const r = rodar({ inadimplenciaPP: 5 });
    expect(soma(r.entradas_medias)).toBeLessThan(soma(ref.entradas_medias));
  });
  it("vendas maiores => entradas maiores", () => {
    const r = rodar({ vendasPct: 20 });
    expect(soma(r.entradas_medias)).toBeGreaterThan(soma(ref.entradas_medias));
  });
  it("fornecedores prorrogados => menos saídas no horizonte", () => {
    const r = rodar({ fornecedoresDU: 10 });
    expect(soma(r.saidas_medias)).toBeLessThan(soma(ref.saidas_medias));
  });
  it("captação aumenta o saldo na data (e amortiza no vencimento)", () => {
    const r = rodar({ captacaoValor: 5_000_000, captacaoDia: 10, captacaoTaxaAM: 2, captacaoPrazoDU: 20 });
    expect(r.quantis.p50[9] - ref.quantis.p50[9]).toBeCloseTo(5_000_000, -2);
    expect(r.quantis.p50[8]).toBeCloseTo(ref.quantis.p50[8], -2);
    expect(r.quantis.p50[40]).toBeLessThan(ref.quantis.p50[40]); // juros pagos
    expect(r.custos.captacao.juros).toBeGreaterThan(0);
  });
  it("antecipação traz caixa à vista com custo positivo", () => {
    const r = rodar({ antecipacaoValor: 4_000_000, antecipacaoTaxaAM: 2 });
    expect(r.custos.antecipacao.custo).toBeGreaterThan(0);
    expect(r.custos.antecipacao.caixa).toBeLessThan(r.custos.antecipacao.face);
    expect(r.quantis.p50[0]).toBeGreaterThan(ref.quantis.p50[0]);
  });
  it("postergação de despesa eleva o saldo entre as datas", () => {
    const r = rodar({ posterValor: 3_000_000, posterDia: 5, posterDias: 15 });
    expect(r.quantis.p50[10] - ref.quantis.p50[10]).toBeCloseTo(3_000_000, -2);
    expect(r.quantis.p50[30]).toBeCloseTo(ref.quantis.p50[30], -2);
  });
  it("caixa mínimo maior => probabilidade de ruptura maior ou igual", () => {
    const r = rodar({ caixaMinimo: base.caixaMinimo + 5_000_000 });
    expect(r.p_romper_no_horizonte).toBeGreaterThanOrEqual(ref.p_romper_no_horizonte);
  });
});

describe("rng", () => {
  it("poisson tem média próxima de λ (pequeno e grande)", () => {
    for (const lam of [3, 18, 45]) {
      const r = new Rng(1);
      let s = 0;
      const n = 20000;
      for (let i = 0; i < n; i++) s += r.poisson(lam);
      expect(Math.abs(s / n - lam)).toBeLessThan(lam * 0.03);
    }
  });
  it("lognormal com mu=-σ²/2 tem média ~1", () => {
    const r = new Rng(2);
    let s = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) s += r.lognormal(-0.18, 0.6);
    expect(Math.abs(s / n - 1)).toBeLessThan(0.03);
  });
});

describe("alavancas <-> query string", () => {
  it("ida e volta; base gera query vazia", () => {
    expect(alavancasParaQuery(base, base)).toBe("");
    const a = { ...base, atrasoGeral: 3, vendasPct: -10, atrasoSeg: { varejo: 2 }, caixaMinimo: 18_000_000 };
    const q = alavancasParaQuery(a, base);
    expect(alavancasDeQuery(q, base)).toEqual(a);
  });
  it("ignora valores inválidos", () => {
    expect(alavancasDeQuery("ag=abc&zz=1", base)).toEqual(base);
  });
});
