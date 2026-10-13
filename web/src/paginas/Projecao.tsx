import { useMemo } from "react";
import { fmtData, fmtMi, fmtPct, TRACO } from "../dados/formato";
import { primeiroDiaAcima } from "../sim/simulador";
import { Grafico, usePaleta } from "../ui/Grafico";
import { Kpi, Selo, Titulo } from "../ui/Pecas";
import { N_NAVEGADOR, SEED_PADRAO, useFolego } from "../ui/contexto";
import { opcaoFan, opcaoProbabilidade, ultimosHistorico } from "../ui/fan";

export function Projecao() {
  const { snapshot: s, base, recalculando } = useFolego();
  const p = usePaleta();
  const hist = useMemo(() => ultimosHistorico(s.saldo_historico, s.as_of, 30), [s]);
  const fan = useMemo(() => opcaoFan(p, base, hist), [p, base, hist]);
  const prob = useMemo(() => opcaoProbabilidade(p, base), [p, base]);

  const i50 = primeiroDiaAcima(base.p_abaixo_minimo, 0.5);
  const i10 = primeiroDiaAcima(base.p_abaixo_minimo, 0.1);
  const folego = base.primeira_ruptura_p50;
  const data = (i: number | null) => (i === null ? TRACO : fmtData(base.datas[i]));

  return (
    <div className="space-y-5">
      <Titulo sub={`Simulação Monte Carlo do saldo de caixa nos próximos ${s.horizonte} dias úteis. A faixa mostra a incerteza: não é uma previsão única.`}>
        Projeção
      </Titulo>

      <div className="flex flex-wrap items-center gap-2" aria-live="polite" data-testid="status-sim">
        {recalculando ? (
          <Selo tom="laranja">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            Recalculando no navegador ({N_NAVEGADOR.toLocaleString("pt-BR")} caminhos)…
          </Selo>
        ) : (
          <Selo tom="azul">Recalculado no navegador: {base.n.toLocaleString("pt-BR")} caminhos, seed {SEED_PADRAO}</Selo>
        )}
        {recalculando && <Selo>Exibindo o pré-computado em Python ({s.projecao_base.n_caminhos.toLocaleString("pt-BR")} caminhos)</Selo>}
      </div>

      <section aria-label="Indicadores de risco" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          rotulo="Probabilidade de romper o mínimo" testId="kpi-prob" destaque="risco"
          valor={fmtPct(base.p_romper_no_horizonte)} sub={`em algum dia dos ${s.horizonte} úteis, mínimo ${fmtMi(base.caixa_minimo)}`}
        />
        <Kpi
          rotulo="Data provável de ruptura" testId="kpi-ruptura" valor={data(i50)}
          sub={`P > 50%: ${data(i50)} · P > 10%: ${data(i10)}`}
        />
        <Kpi
          rotulo="Dias de fôlego" testId="kpi-folego" destaque="risco"
          valor={folego === null ? TRACO : `${folego} d.u.`}
          sub={folego === null ? "nenhuma ruptura simulada" : `mediana dos dias até a 1ª ruptura (${data(folego)})`}
        />
        <Kpi
          rotulo="Cash-at-Risk (95%)" testId="kpi-car" valor={fmtMi(base.cash_at_risk)}
          sub="saldo atual − P5 do pior saldo do horizonte"
        />
      </section>

      <section className="card" aria-labelledby="h-fan">
        <h2 id="h-fan" className="h-sec mb-1">Saldo projetado: faixas de incerteza</h2>
        <p className="muted mb-2">Azul escuro: P25–P75 · médio: P10–P90 · claro: P5–P95 · linha: mediana. Vermelho tracejado: caixa mínimo.</p>
        <Grafico option={fan} altura={400} testId="grafico-fan" rotulo="Leque do saldo de caixa projetado com faixas P5–P95, P10–P90, P25–P75, mediana e linha do caixa mínimo" />
      </section>

      <section className="card" aria-labelledby="h-prob">
        <h2 id="h-prob" className="h-sec mb-1">Probabilidade de o saldo ficar abaixo do mínimo, por dia</h2>
        <p className="muted mb-2">Linhas tracejadas em 10% e 50%.</p>
        <Grafico option={prob} altura={260} testId="grafico-prob" rotulo="Probabilidade de saldo abaixo do caixa mínimo ao longo dos dias úteis" />
      </section>

      <p className="muted">
        Ponto de partida: saldo realizado de {fmtData(s.as_of)}. Resultados dependem das curvas de pagamento históricas sintéticas; veja
        as limitações em “Entenda”.
      </p>
    </div>
  );
}
