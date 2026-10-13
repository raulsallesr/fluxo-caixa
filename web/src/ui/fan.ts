import { fmtData, fmtDataCurta, fmtMi, fmtMiCurto, fmtPct } from "../dados/formato";
import { Paleta, baseOpcoes, eixoCat } from "./Grafico";
import type { Visao } from "./contexto";

/** Últimos `n` pontos do saldo histórico (para dar contexto ao leque). */
export function ultimosHistorico(h: [string, number][], dataBase: string, n = 30): [string, number][] {
  return h.filter(([d]) => d <= dataBase).slice(-n);
}

const pad = (n: number, v: number[]) => [...new Array<null>(n).fill(null), ...v];
const diff = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);

function tooltipFan(v: Visao, nHist: number, rotuloExtra?: (k: number) => string) {
  return (params: unknown) => {
    const arr = params as { dataIndex: number }[];
    const k = (arr[0]?.dataIndex ?? 0) - nHist;
    if (k < 0 || k >= v.datas.length) return "";
    const q = (n: string) => fmtMi(v.quantis[n][k], 2);
    return [
      `<b>${fmtData(v.datas[k])}</b> (dia útil ${k + 1})`,
      `P95: ${q("p95")}<br/>P90: ${q("p90")}<br/>P75: ${q("p75")}`,
      `<b>Mediana: ${q("p50")}</b>`,
      `P25: ${q("p25")}<br/>P10: ${q("p10")}<br/>P5: ${q("p5")}`,
      `P(saldo &lt; mínimo): ${fmtPct(v.p_abaixo_minimo[k])}`,
      rotuloExtra ? rotuloExtra(k) : "",
    ].filter(Boolean).join("<br/>");
  };
}

const eixoY = (p: Paleta) => ({
  type: "value" as const,
  scale: true,
  axisLabel: { color: p.tx2, formatter: (x: number) => fmtMiCurto(x) },
  splitLine: { lineStyle: { color: p.borda } },
  name: "Saldo (R$ mi)",
  nameTextStyle: { color: p.tx2, align: "left" as const },
});

/** Leque do saldo: P5–P95, P10–P90, P25–P75 e mediana, com histórico recente e caixa mínimo. */
export function opcaoFan(p: Paleta, v: Visao, hist: [string, number][]) {
  const nH = hist.length;
  const datas = [...hist.map(([d]) => fmtDataCurta(d)), ...v.datas.map(fmtDataCurta)];
  const q = v.quantis;
  const faixa = (nome: string, valores: number[], alfa: number) => ({
    name: nome, type: "line" as const, stack: "fan", showSymbol: false, silent: true,
    lineStyle: { width: 0 }, areaStyle: { color: p.azul(alfa) }, itemStyle: { color: p.azul(Math.min(alfa * 2.2, 1)) }, data: pad(nH, valores),
  });
  const b = baseOpcoes(p);
  return {
    ...b,
    legend: { top: 0, type: "scroll", selectedMode: false, textStyle: { color: p.tx2 }, data: ["Saldo realizado", "Mediana", "P25–P75", "P10–P90", "P5–P95"] },
    grid: { left: 52, right: 14, top: 44, bottom: 30 },
    xAxis: eixoCat(p, datas),
    yAxis: eixoY(p),
    tooltip: { ...b.tooltip, formatter: tooltipFan(v, nH) },
    series: [
      {
        name: "base", type: "line", stack: "fan", showSymbol: false, silent: true, lineStyle: { width: 0 },
        data: pad(nH, q.p5), tooltip: { show: false },
      },
      faixa("P5–P95", diff(q.p10, q.p5), 0.12),
      faixa("P10–P90", diff(q.p25, q.p10), 0.2),
      faixa("P25–P75", diff(q.p75, q.p25), 0.34),
      faixa("_p75-p90", diff(q.p90, q.p75), 0.2),
      faixa("_p90-p95", diff(q.p95, q.p90), 0.12),
      {
        name: "Mediana", type: "line", showSymbol: false, lineStyle: { width: 2.5, color: p.azul() }, itemStyle: { color: p.azul() },
        data: pad(nH, q.p50),
        markLine: {
          silent: true, symbol: "none",
          label: { formatter: "Caixa mínimo", color: p.vermelho(), position: "insideEndTop" },
          lineStyle: { color: p.vermelho(), type: "dashed", width: 1.5 }, data: [{ yAxis: v.caixa_minimo }],
        },
      },
      {
        name: "Saldo realizado", type: "line", showSymbol: false, lineStyle: { width: 2.5, color: p.cinza() }, itemStyle: { color: p.cinza() },
        data: [...hist.map(([, s]) => s), ...new Array<null>(v.datas.length).fill(null)],
      },
    ],
  };
}

/** P(saldo < mínimo) por dia, com linhas de referência em 10% e 50%. */
export function opcaoProbabilidade(p: Paleta, v: Visao, comparar?: Visao) {
  const datas = v.datas.map(fmtDataCurta);
  const b = baseOpcoes(p);
  const serie = (nome: string, x: Visao, cor: string, area: boolean) => ({
    name: nome, type: "line" as const, showSymbol: false, step: false,
    lineStyle: { width: 2.5, color: cor }, itemStyle: { color: cor },
    ...(area ? { areaStyle: { color: cor.replace(/,[\d.]+\)$/, ",0.18)") } } : {}),
    data: x.p_abaixo_minimo,
  });
  return {
    ...b,
    legend: comparar ? { top: 0, textStyle: { color: p.tx2 } } : undefined,
    grid: { left: 52, right: 14, top: comparar ? 36 : 16, bottom: 30 },
    xAxis: eixoCat(p, datas),
    yAxis: {
      type: "value" as const, min: 0, max: 1,
      axisLabel: { color: p.tx2, formatter: (x: number) => `${Math.round(x * 100)}%` },
      splitLine: { lineStyle: { color: p.borda } },
    },
    tooltip: { ...b.tooltip, valueFormatter: (x: unknown) => (typeof x === "number" ? fmtPct(x) : "—") },
    series: [
      {
        ...serie(comparar ? "Cenário" : "P(saldo < mínimo)", v, p.laranja(1), true),
        markLine: {
          silent: true, symbol: "none", label: { color: p.tx2, formatter: (x: { value: number }) => `${Math.round(x.value * 100)}%`, position: "insideEndTop" },
          lineStyle: { color: p.cinza(), type: "dashed" }, data: [{ yAxis: 0.1 }, { yAxis: 0.5 }],
        },
      },
      ...(comparar ? [serie("Base", comparar, p.cinza(1), false)] : []),
    ],
  };
}

/** Base x cenário no mesmo leque: mediana e P10–P90 das duas. */
export function opcaoComparacao(p: Paleta, base: Visao, cen: Visao, hist: [string, number][]) {
  const nH = hist.length;
  const datas = [...hist.map(([d]) => fmtDataCurta(d)), ...cen.datas.map(fmtDataCurta)];
  const banda = (nome: string, x: Visao, pilha: string, cor: (a: number) => string, alfa: number) => [
    { name: `_b-${pilha}`, type: "line" as const, stack: pilha, showSymbol: false, silent: true, lineStyle: { width: 0 }, data: pad(nH, x.quantis.p10), tooltip: { show: false } },
    { name: nome, type: "line" as const, stack: pilha, showSymbol: false, silent: true, lineStyle: { width: 0 }, areaStyle: { color: cor(alfa) }, itemStyle: { color: cor(0.5) }, data: pad(nH, diff(x.quantis.p90, x.quantis.p10)) },
  ];
  const b0 = baseOpcoes(p);
  return {
    ...b0,
    legend: {
      top: 0, type: "scroll", selectedMode: false, textStyle: { color: p.tx2 },
      data: ["Base: mediana", "Base: P10–P90", "Cenário: mediana", "Cenário: P10–P90", "Saldo realizado"],
    },
    grid: { left: 52, right: 14, top: 56, bottom: 30 },
    xAxis: eixoCat(p, datas),
    yAxis: eixoY(p),
    tooltip: {
      ...b0.tooltip,
      formatter: (params: unknown) => {
        const k = ((params as { dataIndex: number }[])[0]?.dataIndex ?? 0) - nH;
        if (k < 0 || k >= cen.datas.length) return "";
        const f = (x: Visao) => `${fmtMi(x.quantis.p50[k], 2)} (P10 ${fmtMi(x.quantis.p10[k], 1)} · P90 ${fmtMi(x.quantis.p90[k], 1)})`;
        return [
          `<b>${fmtData(cen.datas[k])}</b> (dia útil ${k + 1})`,
          `Base: ${f(base)}`, `Cenário: ${f(cen)}`,
          `P(&lt; mínimo): base ${fmtPct(base.p_abaixo_minimo[k])} · cenário ${fmtPct(cen.p_abaixo_minimo[k])}`,
        ].join("<br/>");
      },
    },
    series: [
      ...banda("Base: P10–P90", base, "sb", p.cinza, 0.22),
      ...banda("Cenário: P10–P90", cen, "sc", p.azul, 0.22),
      {
        name: "Base: mediana", type: "line", showSymbol: false, lineStyle: { width: 2, type: "dashed", color: p.cinza() }, itemStyle: { color: p.cinza() },
        data: pad(nH, base.quantis.p50),
      },
      {
        name: "Cenário: mediana", type: "line", showSymbol: false, lineStyle: { width: 2.5, color: p.azul() }, itemStyle: { color: p.azul() },
        data: pad(nH, cen.quantis.p50),
        markLine: {
          silent: true, symbol: "none",
          label: { formatter: "Caixa mínimo", color: p.vermelho(), position: "insideEndTop" },
          lineStyle: { color: p.vermelho(), type: "dashed", width: 1.5 }, data: [{ yAxis: cen.caixa_minimo }],
        },
      },
      {
        name: "Saldo realizado", type: "line", showSymbol: false, lineStyle: { width: 2, color: p.tx2 }, itemStyle: { color: p.tx2 },
        data: [...hist.map(([, s]) => s), ...new Array<null>(cen.datas.length).fill(null)],
      },
    ],
  };
}
