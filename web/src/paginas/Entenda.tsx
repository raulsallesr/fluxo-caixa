import { ReactNode, useMemo } from "react";
import { fmtData, fmtMi, fmtPct } from "../dados/formato";
import { Grafico, baseOpcoes, usePaleta } from "../ui/Grafico";
import { Titulo } from "../ui/Pecas";
import { useFolego } from "../ui/contexto";

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="h-sec mb-2">{titulo}</h2>
      <div className="max-w-3xl space-y-2 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

export function Entenda() {
  const { snapshot: s } = useFolego();
  const p = usePaleta();
  const bt = s.backtest;

  const opcao = useMemo(() => {
    const cats = ["Entradas", "Saídas", "Saldo"];
    const b = baseOpcoes(p);
    return {
      ...b,
      legend: { top: 0, textStyle: { color: p.tx2 } },
      grid: { left: 48, right: 14, top: 40, bottom: 30 },
      xAxis: { type: "category", data: cats, axisLabel: { color: p.tx2, interval: 0 }, axisLine: { lineStyle: { color: p.borda } } },
      yAxis: { type: "value", axisLabel: { color: p.tx2, formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: { lineStyle: { color: p.borda } } },
      tooltip: { ...b.tooltip, valueFormatter: (v: unknown) => (typeof v === "number" ? fmtPct(v) : "—") },
      series: [
        {
          name: "Modelo (método direto + curvas)", type: "bar", itemStyle: { color: p.azul() },
          label: { show: true, position: "top", color: p.tx2, formatter: (x: { value: number }) => fmtPct(x.value) },
          data: [bt.entradas.wape_modelo, bt.saidas.wape_modelo, bt.saldo.erro_relativo_modelo],
        },
        {
          name: "Média do passado", type: "bar", itemStyle: { color: p.cinza() },
          label: { show: true, position: "top", color: p.tx2, formatter: (x: { value: number }) => fmtPct(x.value) },
          data: [bt.entradas.wape_baseline, bt.saidas.wape_baseline, bt.saldo.erro_relativo_baseline],
        },
      ],
    };
  }, [p, bt]);

  const linhas = [
    { m: "Entradas semanais (WAPE)", mod: fmtPct(bt.entradas.wape_modelo), base: fmtPct(bt.entradas.wape_baseline) },
    { m: "Saídas semanais (WAPE)", mod: fmtPct(bt.saidas.wape_modelo), base: fmtPct(bt.saidas.wape_baseline) },
    { m: "Saldo semanal (erro relativo médio)", mod: fmtPct(bt.saldo.erro_relativo_modelo), base: fmtPct(bt.saldo.erro_relativo_baseline) },
    { m: "Saldo semanal (erro médio em R$)", mod: fmtMi(bt.saldo.erro_medio_modelo, 2), base: fmtMi(bt.saldo.erro_medio_baseline, 2) },
    { m: "Entradas diárias D-1 (WAPE)", mod: fmtPct(bt.diario.entrada.wape_modelo), base: fmtPct(bt.diario.entrada.wape_baseline) },
    { m: "Saídas diárias D-1 (WAPE)", mod: fmtPct(bt.diario.saida.wape_modelo), base: fmtPct(bt.diario.saida.wape_baseline) },
  ];
  const origens = [...bt.origens].sort();

  return (
    <div className="space-y-5">
      <Titulo sub="Como a previsão é feita, o quanto ela acertou no passado e onde ela não deve ser levada a sério.">
        Entenda
      </Titulo>

      <div className="rounded-xl border border-laranja/50 bg-laranja/10 p-4 text-sm" role="note" data-testid="aviso-sintetico">
        <b>Dados 100% sintéticos.</b> A empresa ({s.empresa}) e todos os valores foram gerados por computador para fins educacionais. Nada aqui
        representa uma empresa real, e o conteúdo não é recomendação financeira.
      </div>

      <Bloco titulo="1. Método direto: o que já é conhecido">
        <p>
          Parte do caixa dos próximos dias já está “contratada”: duplicatas a receber e a pagar em aberto e despesas recorrentes (folha,
          tributos, aluguel, dívida). Cada título tem um vencimento; a agenda de recorrentes tem data certa. Essa é a base da projeção.
        </p>
      </Bloco>
      <Bloco titulo="2. Curvas de pagamento: quando o dinheiro de fato muda de mão">
        <p>
          Ninguém paga exatamente no vencimento. Para cada segmento de clientes (atacado, grandes contas, varejo) e para fornecedores, o
          histórico gera uma <b>curva de atraso</b>: a chance de pagar com 0, 1, 2… dias úteis de atraso, mais a chance de nunca pagar (perda).
          Um título já atrasado só pode ser pago de agora em diante: a curva é condicionada ao que já aconteceu.
        </p>
      </Bloco>
      <Bloco titulo="3. Faturas futuras: o que ainda nem foi emitido">
        <p>
          Dentro do horizonte de {s.horizonte} dias úteis haverá vendas e compras novas. Elas são sorteadas com um processo de Poisson (número de
          faturas por dia, com sazonalidade mensal), valor lognormal em torno do ticket médio e prazo de pagamento observado. Cada fatura nova
          também passa pela curva de atraso.
        </p>
      </Bloco>
      <Bloco titulo="4. Monte Carlo: mostrar a incerteza em vez de um número só">
        <p>
          O simulador repete a projeção milhares de vezes, sorteando atrasos, perdas e faturas novas. Cada repetição é um “caminho” possível
          do saldo. A faixa do gráfico mostra onde ficam 50% (P25–P75), 80% (P10–P90) e 90% (P5–P95) dos caminhos. A probabilidade de romper
          o caixa mínimo é a fração de caminhos que cruzam essa linha; o Cash-at-Risk é o saldo atual menos o pior saldo do horizonte no cenário
          ruim (P5). A simulação roda no seu navegador, em um Web Worker, com seed fixa, então é reprodutível.
        </p>
      </Bloco>

      <section className="card" aria-labelledby="h-bt">
        <h2 id="h-bt" className="h-sec mb-1">Backtest: o modelo contra a “média do passado”</h2>
        <p className="muted mb-3">
          Em {bt.n_origens} datas de origem no passado ({fmtData(origens[0])} a {fmtData(origens[origens.length - 1])}), o modelo (usando só a
          informação disponível na época) projetou {bt.horizonte_semanas} semanas à frente; comparamos com o que realmente aconteceu. WAPE =
          soma dos erros absolutos ÷ soma dos valores reais (menor é melhor). A referência simples projeta a média do passado recente.
        </p>
        <Grafico option={opcao} altura={300} testId="grafico-backtest" rotulo="Barras comparando o erro do modelo e da média do passado para entradas, saídas e saldo semanais" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm" data-testid="tabela-backtest">
            <caption className="sr-only">Erros do backtest, modelo contra média do passado</caption>
            <thead><tr><th scope="col" className="th !text-left">Métrica</th><th scope="col" className="th !whitespace-normal">Modelo</th><th scope="col" className="th !whitespace-normal">Média do passado</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.m} className="border-t border-borda">
                  <th scope="row" className="px-3 py-2 text-left font-normal">{l.m}</th>
                  <td className="td font-medium">{l.mod}</td><td className="td">{l.base}</td>
                </tr>
              ))}
              <tr className="border-t border-borda">
                <th scope="row" className="px-3 py-2 text-left font-normal">Cobertura da faixa P10–P90 (alvo 80%)</th>
                <td className="td font-medium">{fmtPct(bt.cobertura.p10_p90)}</td><td className="td">—</td>
              </tr>
              <tr className="border-t border-borda">
                <th scope="row" className="px-3 py-2 text-left font-normal">Cobertura da faixa P5–P95 (alvo 90%)</th>
                <td className="td font-medium">{fmtPct(bt.cobertura.p5_p95)}</td><td className="td">—</td>
              </tr>
              <tr className="border-t border-borda">
                <th scope="row" className="px-3 py-2 text-left font-normal">Origens avaliadas</th>
                <td className="td font-medium">{bt.n_origens}</td><td className="td">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <Bloco titulo="Limitações">
        <ul className="list-disc space-y-1 pl-5">
          <li>Os dados são sintéticos: o comportamento de pagamento vem do gerador, não de clientes reais.</li>
          <li>As faixas ficam um pouco estreitas: a cobertura observada ({fmtPct(bt.cobertura.p10_p90)} e {fmtPct(bt.cobertura.p5_p95)}) é menor que a nominal (80% e 90%). Tratar a incerteza como um mínimo.</li>
          <li>Apenas {bt.n_origens} origens no backtest: o resultado é indicativo, não conclusivo.</li>
          <li>Eventos fora do histórico (choques de demanda, calote de grande cliente, mudança de política) não são antecipados; use a página Cenários para testá-los.</li>
          <li>Faturas de um mesmo dia são independentes entre si; não há correlação entre clientes nem entre atrasos.</li>
          <li>Na antecipação e na captação, tributos, tarifas e garantias não são considerados.</li>
          <li>Projeto educacional: não é recomendação financeira nem parecer regulatório.</li>
        </ul>
      </Bloco>
    </div>
  );
}
