import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  AxisPointerComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([
  BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent,
  MarkAreaComponent, AxisPointerComponent, CanvasRenderer,
]);

export interface Paleta {
  azul: (a?: number) => string;
  laranja: (a?: number) => string;
  vermelho: (a?: number) => string;
  verde: (a?: number) => string;
  cinza: (a?: number) => string;
  tx: string;
  tx2: string;
  borda: string;
  surf: string;
}

function ler(nome: string): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${nome}`).trim().split(/\s+/).map(Number);
  return [v[0] || 0, v[1] || 0, v[2] || 0];
}
const mk = (nome: string) => (a = 1) => {
  const [r, g, b] = ler(nome);
  return `rgba(${r},${g},${b},${a})`;
};

export function lerPaleta(): Paleta {
  const solido = (n: string) => mk(n)(1);
  return {
    azul: mk("azul"), laranja: mk("laranja"), vermelho: mk("vermelho"), verde: mk("verde"), cinza: mk("cinza"),
    tx: solido("tx"), tx2: solido("tx2"), borda: solido("borda"), surf: solido("surf"),
  };
}

/** Paleta resolvida dos tokens CSS; atualiza quando o tema do sistema muda. */
export function usePaleta(): Paleta {
  const [p, setP] = useState<Paleta>(() => lerPaleta());
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => setP(lerPaleta());
    mq.addEventListener("change", f);
    f();
    return () => mq.removeEventListener("change", f);
  }, []);
  return p;
}

interface Props {
  option: EChartsCoreOption;
  altura?: number;
  /** Texto alternativo (resumo do que o gráfico mostra). */
  rotulo: string;
  testId?: string;
}

export function Grafico({ option, altura = 320, rotulo, testId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={rotulo}
      data-testid={testId}
      style={{ height: altura, width: "100%" }}
    />
  );
}

/** Estilo base de eixos/tooltip consistente entre gráficos. */
export function baseOpcoes(p: Paleta) {
  return {
    textStyle: { color: p.tx2, fontFamily: "Inter, system-ui, Segoe UI, Roboto, sans-serif" },
    animation: false,
    tooltip: {
      trigger: "axis" as const,
      confine: true,
      backgroundColor: p.surf,
      borderColor: p.borda,
      textStyle: { color: p.tx, fontSize: 12 },
      extraCssText: "font-variant-numeric: tabular-nums; max-width: 86vw;",
    },
  };
}

export const eixoCat = (p: Paleta, datas: string[]) => ({
  type: "category" as const,
  data: datas,
  boundaryGap: false,
  axisLine: { lineStyle: { color: p.borda } },
  axisLabel: { color: p.tx2, hideOverlap: true },
  axisTick: { show: false },
});
