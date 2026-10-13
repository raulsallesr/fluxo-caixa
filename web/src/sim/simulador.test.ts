import { describe, expect, it } from "vitest";
import { alavancasBase } from "./alavancas";
import { dadosDoSnapshot, simular } from "./simulador";
import { lerSnapshot } from "./helpers.test-util";

const snap = lerSnapshot();
const dados = dadosDoSnapshot(snap);
const base = alavancasBase(snap.caixa_minimo);

describe("paridade com o motor Python (N=5000)", () => {
  const r = simular(dados, { n: 5000, seed: 2026, alavancas: base });
  const py = snap.projecao_base;
  const linhas: string[] = [];

  it.each([5, 20, 40, 65])("quantis do saldo no dia %i", (dia) => {
    for (const q of ["p50", "p10", "p90"]) {
      const ts = r.quantis[q][dia - 1];
      const pyv = py.quantis[q][dia - 1];
      const tol = Math.max(0.03 * Math.abs(pyv), 600_000);
      linhas.push(`dia ${dia} ${q}: ts=${ts.toFixed(0)} py=${pyv.toFixed(0)} dif=${(ts - pyv).toFixed(0)} (tol ${tol.toFixed(0)})`);
      expect(Math.abs(ts - pyv)).toBeLessThanOrEqual(tol);
    }
  });
  it("probabilidade de romper no horizonte", () => {
    linhas.push(`p_romper ts=${r.p_romper_no_horizonte} py=${py.p_romper_no_horizonte}`);
    expect(Math.abs(r.p_romper_no_horizonte - py.p_romper_no_horizonte)).toBeLessThanOrEqual(0.05);
  });
  it("primeira ruptura mediana e cash-at-risk próximos", () => {
    linhas.push(`primeira ts=${r.primeira_ruptura_p50} py=${py.primeira_ruptura_p50}; CaR ts=${r.cash_at_risk.toFixed(0)} py=${py.cash_at_risk.toFixed(0)}`);
    expect(Math.abs((r.primeira_ruptura_p50 ?? 0) - (py.primeira_ruptura_p50 ?? 0))).toBeLessThanOrEqual(3);
    expect(Math.abs(r.cash_at_risk - py.cash_at_risk)).toBeLessThanOrEqual(Math.max(0.1 * py.cash_at_risk, 600_000));
  });
  it("imprime a comparação", () => {
    console.log(linhas.join("\n"));
  });
});
