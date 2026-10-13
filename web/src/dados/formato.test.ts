import { describe, expect, it } from "vitest";
import { diaSemana, fmtBRL, fmtData, fmtDeltaMi, fmtMi, fmtPct, quantil, TRACO, wape } from "./formato";
import { ErroSnapshot, validarSnapshot } from "./carregar";
import { lerSnapshot } from "../sim/helpers.test-util";

describe("formatação", () => {
  it("BRL", () => {
    expect(fmtBRL(1234567.4)).toBe("R$ 1.234.567");
    expect(fmtBRL(null)).toBe(TRACO);
    expect(fmtBRL(0)).toBe("R$ 0");
  });
  it("milhões, percentuais e deltas", () => {
    expect(fmtMi(22_595_011)).toBe("R$ 22,6 mi");
    expect(fmtMi(undefined)).toBe(TRACO);
    expect(fmtPct(0.118)).toBe("11,8%");
    expect(fmtPct(null)).toBe(TRACO);
    expect(fmtDeltaMi(-1_500_000)).toBe("−R$ 1,5 mi");
    expect(fmtDeltaMi(2_000_000)).toBe("+R$ 2,0 mi");
  });
  it("datas", () => {
    expect(fmtData("2026-10-13")).toBe("13/10/2026");
    expect(fmtData(null)).toBe(TRACO);
    expect(diaSemana("2026-10-13")).toBe("ter");
  });
});

describe("métricas", () => {
  it("WAPE", () => {
    expect(wape([100, 100], [90, 120])).toBeCloseTo(0.15, 10);
    expect(wape([0, 0], [1, 2])).toBeNull();
    expect(wape([], [])).toBeNull();
  });
  it("quantil interpola como o numpy", () => {
    expect(quantil([1, 2, 3, 4], 50)).toBe(2.5);
    expect(quantil([1, 2, 3, 4], 0)).toBe(1);
    expect(quantil([1, 2, 3, 4], 100)).toBe(4);
  });
});

describe("validação do snapshot", () => {
  it("aceita o snapshot gerado", () => {
    expect(validarSnapshot(lerSnapshot()).versao).toBe(1);
  });
  it("rejeita versão diferente e campo faltante", () => {
    expect(() => validarSnapshot({ ...lerSnapshot(), versao: 99 })).toThrow(ErroSnapshot);
    const { modelo: _m, ...sem } = lerSnapshot();
    expect(() => validarSnapshot({ ...sem, versao: 1 })).toThrow(/modelo/);
    expect(() => validarSnapshot(null)).toThrow(ErroSnapshot);
  });
});
