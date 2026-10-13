import { useCallback, useMemo, useState } from "react";
import { diaSemana, fmtData, fmtDataCurta, fmtMi, fmtMiCurto, fmtPct, TRACO } from "../dados/formato";
import type { LinhaCategoria, LinhaDiario } from "../dados/tipos";
import { Grafico, baseOpcoes, eixoCat, usePaleta } from "../ui/Grafico";
import { Gaveta } from "../ui/Gaveta";
import { Kpi, Titulo } from "../ui/Pecas";
import { useFolego } from "../ui/contexto";

const cel = (v: number | null) => (v === null ? TRACO : fmtMi(v, 2).replace("R$ ", ""));
const desvio = (real: number | null, esp: number) => (real === null ? null : real - esp);
const sinal = (v: number | null) =>
  v === null ? TRACO : `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtMi(Math.abs(v), 2).replace("R$ ", "")}`;

export function Hoje() {
  const { snapshot: s } = useFolego();
  const p = usePaleta();
  const [sel, setSel] = useState<LinhaDiario | null>(null);
  const fechar = useCallback(() => setSel(null), []);

  const reais = s.diario.filter((l) => !l.futuro);
  const atual = reais[reais.length - 1];
  const bt = s.backtest.diario;
  const margem = atual.saldo_final_real === null ? null : atual.saldo_final_real - s.caixa_minimo;

  const opcao = useMemo(() => {
    const d = s.diario;
    const datas = d.map((l) => fmtDataCurta(l.data));
    const iFut = d.findIndex((l) => l.futuro);
    const b = baseOpcoes(p);
    return {
      ...b,
      legend: { top: 0, textStyle: { color: p.tx2 }, itemGap: 12, type: "scroll" },
      grid: [
        { left: 52, right: 14, top: 56, height: "38%" },
        { left: 52, right: 14, top: "62%", bottom: 28 },
      ],
      xAxis: [
        { ...eixoCat(p, datas), gridIndex: 0, axisLabel: { show: false } },
        { ...eixoCat(p, datas), gridIndex: 1, boundaryGap: true },
      ],
      yAxis: [
        {
          type: "value", gridIndex: 0, scale: true,
          axisLabel: { color: p.tx2, formatter: (v: number) => fmtMiCurto(v) },
          splitLine: { lineStyle: { color: p.borda } },
          name: "Saldo (R$ mi)", nameTextStyle: { color: p.tx2, align: "left" },
        },
        {
          type: "value", gridIndex: 1,
          axisLabel: { color: p.tx2, formatter: (v: number) => fmtMiCurto(v) },
          splitLine: { lineStyle: { color: p.borda } },
          name: "Fluxo (R$ mi)", nameTextStyle: { color: p.tx2, align: "left" },
        },
      ],
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: {
        ...b.tooltip,
        valueFormatter: (v: unknown) => (typeof v === "number" ? fmtMi(v, 2) : TRACO),
      },
      series: [
        {
          name: "Saldo realizado", type: "line", xAxisIndex: 0, yAxisIndex: 0, showSymbol: false,
          lineStyle: { width: 2.5, color: p.azul() }, itemStyle: { color: p.azul() },
          data: d.map((l) => l.saldo_final_real),
        },
        {
          name: "Saldo esperado (D-1)", type: "line", xAxisIndex: 0, yAxisIndex: 0, showSymbol: false,
          lineStyle: { width: 2, type: "dashed", color: p.cinza() }, itemStyle: { color: p.cinza() },
          data: d.map((l) => l.saldo_final_esperado),
          markLine: {
            silent: true, symbol: "none",
            label: { formatter: "Caixa mínimo", color: p.vermelho(), position: "insideEndTop" },
            lineStyle: { color: p.vermelho(), type: "dashed", width: 1.5 },
            data: [{ yAxis: s.caixa_minimo }],
          },
          markArea: iFut < 0 ? undefined : {
            silent: true, itemStyle: { color: p.azul(0.08) }, label: { color: p.tx2, position: "insideTop" },
            data: [[{ name: "projeção", xAxis: iFut }, { xAxis: d.length - 1 }]],
          },
        },
        {
          name: "Entradas", type: "bar", xAxisIndex: 1, yAxisIndex: 1, itemStyle: { color: p.azul() },
          data: d.map((l) => ({
            value: l.futuro ? l.entradas_proj : l.entradas_real,
            itemStyle: { color: p.azul(l.futuro ? 0.45 : 1) },
          })),
        },
        {
          name: "Saídas", type: "bar", xAxisIndex: 1, yAxisIndex: 1, itemStyle: { color: p.laranja() },
          data: d.map((l) => ({
            value: -(l.futuro ? l.saidas_proj : (l.saidas_real ?? 0)),
            itemStyle: { color: p.laranja(l.futuro ? 0.45 : 1) },
          })),
        },
      ],
    };
  }, [s, p]);

  const linhas = useMemo(() => [...s.diario].reverse(), [s]);

  return (
    <div className="space-y-5">
      <Titulo sub="Previsão do dia a dia contra o que de fato entrou e saiu. As linhas em azul claro são projeção (ainda sem realizado).">
        Hoje
      </Titulo>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Saldo atual" testId="kpi-saldo" valor={fmtMi(atual.saldo_final_real)} sub={`em ${fmtData(atual.data)}`} destaque="ok" />
        <Kpi
          rotulo="Caixa mínimo" testId="kpi-minimo" valor={fmtMi(s.caixa_minimo)}
          sub={margem === null ? TRACO : `${margem >= 0 ? "folga" : "abaixo"} de ${fmtMi(Math.abs(margem))}`}
        />
        <Kpi
          rotulo="Erro D-1 das entradas (WAPE)" testId="kpi-wape-ent" valor={fmtPct(bt.entrada.wape_modelo)}
          sub={`média do passado: ${fmtPct(bt.entrada.wape_baseline)}`}
        />
        <Kpi
          rotulo="Erro D-1 das saídas (WAPE)" testId="kpi-wape-sai" valor={fmtPct(bt.saida.wape_modelo)}
          sub={`média do passado: ${fmtPct(bt.saida.wape_baseline)}`}
        />
      </section>

      <section className="card" aria-labelledby="h-graf">
        <h2 id="h-graf" className="h-sec mb-1">Saldo realizado x esperado, entradas e saídas</h2>
        <p className="muted mb-2">
          Saldo esperado = saldo do dia anterior + entradas e saídas projetadas (D-1). Barras: entradas para cima, saídas para baixo.
        </p>
        <Grafico
          option={opcao} altura={460} testId="grafico-hoje"
          rotulo="Gráfico do saldo realizado e esperado por dia, com barras de entradas e saídas e a linha do caixa mínimo"
        />
      </section>

      <section className="card" aria-labelledby="h-tab">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="h-tab" className="h-sec">Tabela diária (R$ mi)</h2>
          <span className="muted">Toque numa linha para ver as categorias.</span>
        </div>
        <div className="tabela-wrap border border-borda" tabIndex={0} role="region" aria-label="Tabela diária; role para ver mais colunas">
          <table className="w-full min-w-[920px] border-collapse" data-testid="tabela-diaria">
            <caption className="sr-only">Fluxo de caixa diário: projetado, realizado e desvio</caption>
            <thead>
              <tr>
                <th scope="col" className="th !text-left">Data</th>
                <th scope="col" className="th">Saldo inicial</th>
                <th scope="col" className="th">Entradas proj.</th>
                <th scope="col" className="th">Entradas real.</th>
                <th scope="col" className="th">Saídas proj.</th>
                <th scope="col" className="th">Saídas real.</th>
                <th scope="col" className="th">Saldo final esperado</th>
                <th scope="col" className="th">Saldo final realizado</th>
                <th scope="col" className="th">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const dv = desvio(l.saldo_final_real, l.saldo_final_esperado);
                const abrir = () => setSel(l);
                return (
                  <tr
                    key={l.data}
                    className={`clicavel border-t border-borda ${l.futuro ? "linha-proj" : ""}`}
                    tabIndex={0}
                    onClick={abrir}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        abrir();
                      }
                    }}
                    aria-label={`${fmtData(l.data)}${l.futuro ? ", projeção" : ""}. Abrir categorias.`}
                    data-testid="linha-dia"
                  >
                    <th scope="row" className="td !text-left font-medium">
                      {fmtData(l.data)} <span className="text-xs text-tx2">{diaSemana(l.data)}</span>
                      {l.futuro && (
                        <span className="ml-1 rounded bg-azul/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-azul">projeção</span>
                      )}
                    </th>
                    <td className="td">{cel(l.saldo_inicial)}</td>
                    <td className="td">{cel(l.entradas_proj)}</td>
                    <td className="td">{cel(l.entradas_real)}</td>
                    <td className="td">{cel(l.saidas_proj)}</td>
                    <td className="td">{cel(l.saidas_real)}</td>
                    <td className="td">{cel(l.saldo_final_esperado)}</td>
                    <td className="td font-medium">{cel(l.saldo_final_real)}</td>
                    <td className="td">{sinal(dv)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Gaveta aberta={sel !== null} onFechar={fechar} titulo={sel ? `Categorias em ${fmtData(sel.data)}${sel.futuro ? " (projeção)" : ""}` : ""}>
        {sel && <DrillDown linha={sel} categorias={s.categorias} />}
      </Gaveta>
    </div>
  );
}

interface Grupo {
  chave: string;
  proj: number;
  real: number | null;
  itens: LinhaCategoria[];
}

function agrupar(itens: LinhaCategoria[]): Grupo[] {
  const m = new Map<string, Grupo>();
  for (const i of itens) {
    const g = m.get(i.categoria) ?? { chave: i.categoria, proj: 0, real: null, itens: [] };
    g.proj += i.projetado;
    if (i.realizado !== null) g.real = (g.real ?? 0) + i.realizado;
    g.itens.push(i);
    m.set(i.categoria, g);
  }
  return [...m.values()].sort((a, b) => b.proj - a.proj);
}

function DrillDown({ linha, categorias }: { linha: LinhaDiario; categorias: LinhaCategoria[] }) {
  const doDia = categorias.filter((c) => c.data === linha.data);
  return (
    <div className="space-y-5" data-testid="drilldown">
      {(["entrada", "saida"] as const).map((tipo) => {
        const grupos = agrupar(doDia.filter((c) => c.tipo === tipo));
        const nome = tipo === "entrada" ? "Entradas" : "Saídas";
        return (
          <div key={tipo}>
            <h3 className="mb-1 text-sm font-semibold">{nome}</h3>
            {grupos.length === 0 ? (
              <p className="muted">Sem lançamentos neste dia ({TRACO}).</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{nome} por categoria e subcategoria</caption>
                <thead>
                  <tr>
                    <th scope="col" className="th !text-left">Categoria</th>
                    <th scope="col" className="th">Proj.</th>
                    <th scope="col" className="th">Real.</th>
                    <th scope="col" className="th">Desvio</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <GrupoLinhas key={g.chave} g={g} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      <p className="muted">Valores em R$ mi. Desvio = realizado − projetado; "—" quando ainda não há realizado.</p>
    </div>
  );
}

function GrupoLinhas({ g }: { g: Grupo }) {
  const [aberto, setAberto] = useState(true);
  const dv = g.real === null ? null : g.real - g.proj;
  return (
    <>
      <tr className="border-t border-borda bg-surf2/60">
        <th scope="row" className="px-3 py-1 text-left font-semibold">
          <button className="flex min-h-[44px] w-full items-center gap-2 text-left" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
            <span aria-hidden="true">{aberto ? "▾" : "▸"}</span>
            {g.chave}
          </button>
        </th>
        <td className="td">{cel(g.proj)}</td>
        <td className="td">{cel(g.real)}</td>
        <td className="td">{sinal(dv)}</td>
      </tr>
      {aberto &&
        g.itens.map((i) => (
          <tr key={i.subcategoria} className="border-t border-borda/60">
            <th scope="row" className="px-3 py-2 pl-8 text-left font-normal">{i.subcategoria}</th>
            <td className="td">{cel(i.projetado)}</td>
            <td className="td">{cel(i.realizado)}</td>
            <td className="td">{sinal(i.realizado === null ? null : i.realizado - i.projetado)}</td>
          </tr>
        ))}
    </>
  );
}
