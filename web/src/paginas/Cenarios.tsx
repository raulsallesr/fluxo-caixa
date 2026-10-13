import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fmtData, fmtDeltaMi, fmtDeltaPP, fmtMi, fmtPct, TRACO } from "../dados/formato";
import { Alavancas, alavancasBase, alavancasDeQuery, alavancasParaQuery, ehBase } from "../sim/alavancas";
import { Cancelado } from "../sim/cliente";
import { ResultadoSim } from "../sim/simulador";
import { Grafico, usePaleta } from "../ui/Grafico";
import { Kpi, Selo, Titulo } from "../ui/Pecas";
import { N_NAVEGADOR, SEED_PADRAO, Visao, useFolego, visaoDeResultado } from "../ui/contexto";
import { opcaoComparacao, opcaoProbabilidade, ultimosHistorico } from "../ui/fan";

const ROTULO_SEG: Record<string, string> = { atacado: "Atacado", grandes_contas: "Grandes contas", varejo: "Varejo" };
const MI = 1e6;

interface SliderProps {
  id: string;
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  unidade: string;
  escala?: number;
  casas?: number;
  onChange: (v: number) => void;
  dica?: string;
}

function Slider({ id, rotulo, valor, min, max, passo, unidade, escala = 1, casas = 0, onChange, dica }: SliderProps) {
  const exibe = valor / escala;
  const fmt = (x: number) => x.toFixed(casas);
  return (
    <div className="py-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="min-w-0 flex-1 basis-40 text-sm font-medium">{rotulo}</label>
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            aria-label={`${rotulo} (valor)`} type="number" inputMode="decimal" className="campo-num !w-24"
            value={fmt(exibe)} min={min} max={max} step={passo}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(Math.min(Math.max(n, min), max) * escala);
            }}
          />
          <span className="w-10 text-xs text-tx2">{unidade}</span>
        </div>
      </div>
      <input id={id} type="range" min={min} max={max} step={passo} value={exibe} onChange={(e) => onChange(Number(e.target.value) * escala)} />
      {dica && <p className="-mt-1 text-xs text-tx2">{dica}</p>}
    </div>
  );
}

function Grupo({ titulo, children, aberto = false }: { titulo: string; children: ReactNode; aberto?: boolean }) {
  return (
    <details className="card !p-0" open={aberto}>
      <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-sm font-semibold">{titulo}</summary>
      <div className="space-y-1 border-t border-borda px-4 py-3">{children}</div>
    </details>
  );
}

export function Cenarios() {
  const { snapshot: s, cliente, base, baseResultado } = useFolego();
  const p = usePaleta();
  const [sp, setSp] = useSearchParams();
  const base0 = useMemo(() => alavancasBase(s.caixa_minimo), [s.caixa_minimo]);
  const a = useMemo(() => alavancasDeQuery(sp.toString(), base0), [sp, base0]);
  const hist = useMemo(() => ultimosHistorico(s.saldo_historico, s.as_of, 30), [s]);
  const segs = Object.keys(s.modelo.ar_curva);
  const totalAR = useMemo(() => s.titulos_ar.reduce((x, t) => x + t.valor, 0), [s]);
  const datas = base.datas;

  const set = (patch: Partial<Alavancas>) => {
    const prox = { ...a, ...patch };
    setSp(new URLSearchParams(alavancasParaQuery(prox, base0)), { replace: true });
  };

  // ---- simulação do cenário (debounce; o mais recente vence) ----
  const eBase = ehBase(a, base0);
  const chave = alavancasParaQuery(a, base0);
  const [cen, setCen] = useState<ResultadoSim | null>(null);
  const [baseCmp, setBaseCmp] = useState<ResultadoSim | null>(null);
  const [calc, setCalc] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (eBase) {
      setCalc(false);
      setErro(null);
      return;
    }
    const meu = ++seq.current;
    setCalc(true);
    const t = setTimeout(async () => {
      try {
        const r = await cliente.rodar({ n: N_NAVEGADOR, seed: SEED_PADRAO, alavancas: a });
        let b: ResultadoSim | null = baseResultado;
        if (a.caixaMinimo !== s.caixa_minimo) {
          b = await cliente.rodar({ n: N_NAVEGADOR, seed: SEED_PADRAO, alavancas: { ...base0, caixaMinimo: a.caixaMinimo } });
        }
        if (meu !== seq.current) return;
        setCen(r);
        setBaseCmp(b);
        setErro(null);
        setCalc(false);
      } catch (e) {
        if (e instanceof Cancelado || meu !== seq.current) return;
        setErro(e instanceof Error ? e.message : "Falha na simulação.");
        setCalc(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, eBase, cliente, baseResultado]);

  const visBase: Visao = useMemo(() => {
    if (!eBase && baseCmp && a.caixaMinimo !== s.caixa_minimo) return visaoDeResultado(s, baseCmp);
    return base;
  }, [eBase, baseCmp, base, a.caixaMinimo, s]);
  const visCen: Visao = useMemo(() => (eBase || !cen ? visBase : visaoDeResultado(s, cen)), [eBase, cen, visBase, s]);
  const emEspera = !eBase && cen === null;

  const fan = useMemo(() => opcaoComparacao(p, visBase, visCen, hist), [p, visBase, visCen, hist]);
  const prob = useMemo(() => opcaoProbabilidade(p, visCen, visBase), [p, visCen, visBase]);

  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link:", window.location.href);
    }
  };

  const ult = visBase.datas.length - 1;
  const rupt = (v: Visao) => (v.primeira_ruptura_p50 === null ? TRACO : fmtData(v.datas[v.primeira_ruptura_p50]));
  const folego = (v: Visao) => (v.primeira_ruptura_p50 === null ? TRACO : `${v.primeira_ruptura_p50} d.u.`);
  const deltaDias = visCen.primeira_ruptura_p50 !== null && visBase.primeira_ruptura_p50 !== null
    ? visCen.primeira_ruptura_p50 - visBase.primeira_ruptura_p50 : null;
  const linhas: { m: string; b: string; c: string; d: string }[] = [
    { m: "Probabilidade de romper o mínimo", b: fmtPct(visBase.p_romper_no_horizonte), c: fmtPct(visCen.p_romper_no_horizonte), d: fmtDeltaPP(visCen.p_romper_no_horizonte - visBase.p_romper_no_horizonte) },
    { m: "Dias de fôlego (mediana até a 1ª ruptura)", b: folego(visBase), c: folego(visCen), d: deltaDias === null ? TRACO : `${deltaDias > 0 ? "+" : deltaDias < 0 ? "−" : ""}${Math.abs(deltaDias)} d.u.` },
    { m: "Data provável de ruptura", b: rupt(visBase), c: rupt(visCen), d: TRACO },
    { m: "Cash-at-Risk (95%)", b: fmtMi(visBase.cash_at_risk), c: fmtMi(visCen.cash_at_risk), d: fmtDeltaMi(visCen.cash_at_risk - visBase.cash_at_risk) },
    { m: `Saldo mediano em ${fmtData(visBase.datas[ult])}`, b: fmtMi(visBase.quantis.p50[ult]), c: fmtMi(visCen.quantis.p50[ult]), d: fmtDeltaMi(visCen.quantis.p50[ult] - visBase.quantis.p50[ult]) },
    { m: `P10 do saldo em ${fmtData(visBase.datas[ult])}`, b: fmtMi(visBase.quantis.p10[ult]), c: fmtMi(visCen.quantis.p10[ult]), d: fmtDeltaMi(visCen.quantis.p10[ult] - visBase.quantis.p10[ult]) },
  ];
  const custos = cen && !eBase ? cen.custos : null;

  const resultados = (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-2" aria-live="polite" data-testid="status-cenario">
        {calc ? <Selo tom="laranja"><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />Calculando cenário…</Selo>
          : eBase ? <Selo>Cenário igual à base</Selo> : <Selo tom="azul">Cenário calculado: {N_NAVEGADOR.toLocaleString("pt-BR")} caminhos</Selo>}
        {erro && <Selo tom="laranja">{erro}</Selo>}
      </div>

      <section aria-label="Resumo do cenário" className="grid grid-cols-2 gap-3">
        <Kpi rotulo="P(romper o mínimo)" testId="kpi-c-prob" destaque="risco" valor={fmtPct(visCen.p_romper_no_horizonte)}
          sub={`base: ${fmtPct(visBase.p_romper_no_horizonte)}`} />
        <Kpi rotulo="Cash-at-Risk (95%)" testId="kpi-c-car" valor={fmtMi(visCen.cash_at_risk)} sub={`base: ${fmtMi(visBase.cash_at_risk)}`} />
      </section>

      <section className="card" aria-labelledby="h-comp">
        <h2 id="h-comp" className="h-sec mb-1">Base x cenário</h2>
        <p className="muted mb-2">Cinza: base. Azul: cenário. Faixa = P10–P90; linha = mediana.</p>
        {emEspera ? <div className="grid h-[380px] place-items-center text-sm text-tx2" role="status">Calculando…</div>
          : <Grafico option={fan} altura={380} testId="grafico-cenario" rotulo="Comparação do saldo projetado entre a base e o cenário, com mediana e faixa P10–P90" />}
      </section>

      <section className="card" aria-labelledby="h-delta">
        <h2 id="h-delta" className="h-sec mb-2">Variação das métricas de risco</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs sm:text-sm [&_.td]:!px-1.5 [&_.th]:!px-1.5 [&_th[scope=row]]:!px-1.5" data-testid="tabela-delta">
            <caption className="sr-only">Métricas de risco da base e do cenário</caption>
            <thead><tr><th scope="col" className="th !text-left">Métrica</th><th scope="col" className="th">Base</th><th scope="col" className="th">Cenário</th><th scope="col" className="th">Δ</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.m} className="border-t border-borda">
                  <th scope="row" className="px-3 py-2 text-left font-normal">{l.m}</th>
                  <td className="td">{l.b}</td><td className="td font-medium">{l.c}</td><td className="td">{l.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {custos && (custos.antecipacao.face > 0 || custos.captacao.valor > 0) && (
          <ul className="mt-3 space-y-1 text-sm" data-testid="custos">
            {custos.antecipacao.face > 0 && (
              <li>Antecipação: face {fmtMi(custos.antecipacao.face, 2)} → entra {fmtMi(custos.antecipacao.caixa, 2)}; <b>custo {fmtMi(custos.antecipacao.custo, 2)}</b> (desconto até o vencimento, sem regresso).</li>
            )}
            {custos.captacao.valor > 0 && (
              <li>Captação: {fmtMi(custos.captacao.valor, 2)}; <b>juros {fmtMi(custos.captacao.juros, 2)}</b> pagos no vencimento (se dentro do horizonte, entram no saldo).</li>
            )}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="h-pc">
        <h2 id="h-pc" className="h-sec mb-1">P(saldo &lt; mínimo) por dia</h2>
        {emEspera ? null : <Grafico option={prob} altura={240} testId="grafico-prob-cen" rotulo="Probabilidade de saldo abaixo do mínimo por dia, base e cenário" />}
      </section>
    </div>
  );

  const controles = (
    <div className="min-w-0 space-y-3" data-testid="alavancas">
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setSp(new URLSearchParams(), { replace: true })} disabled={eBase} data-testid="restaurar">Restaurar base</button>
        <button className="btn" onClick={copiar} data-testid="copiar">{copiado ? "Link copiado" : "Copiar link do cenário"}</button>
      </div>

      <Grupo titulo="Clientes e vendas" aberto>
        <Slider id="ag" rotulo="Atraso dos clientes (geral)" valor={a.atrasoGeral} min={0} max={20} passo={1} unidade="d.u." onChange={(v) => set({ atrasoGeral: v })} dica="Soma dias úteis ao pagamento de todos os recebíveis." />
        {segs.map((sg) => (
          <Slider key={sg} id={`as-${sg}`} rotulo={`  + ${ROTULO_SEG[sg] ?? sg}`} valor={a.atrasoSeg[sg] ?? 0} min={0} max={20} passo={1} unidade="d.u."
            onChange={(v) => set({ atrasoSeg: { ...a.atrasoSeg, [sg]: v } })} />
        ))}
        <Slider id="ip" rotulo="Inadimplência adicional" valor={a.inadimplenciaPP} min={0} max={10} passo={0.5} casas={1} unidade="p.p." onChange={(v) => set({ inadimplenciaPP: v })} dica="Soma à probabilidade de perda de cada segmento." />
        <Slider id="vp" rotulo="Choque de vendas" valor={a.vendasPct} min={-30} max={30} passo={1} unidade="%" onChange={(v) => set({ vendasPct: v })} dica="Escala a quantidade de faturas futuras; compras e despesas não mudam." />
      </Grupo>

      <Grupo titulo="Fornecedores e despesas">
        <Slider id="fd" rotulo="Prorrogação de fornecedores" valor={a.fornecedoresDU} min={0} max={20} passo={1} unidade="d.u." onChange={(v) => set({ fornecedoresDU: v })} />
        <Slider id="pv" rotulo="Postergar despesa: valor" valor={a.posterValor} min={0} max={10} passo={0.5} casas={1} escala={MI} unidade="R$ mi" onChange={(v) => set({ posterValor: v })} />
        <Slider id="pd" rotulo="Postergar despesa: dia útil original" valor={a.posterDia} min={1} max={s.horizonte} passo={1} unidade="dia" onChange={(v) => set({ posterDia: v })} dica={`Data: ${fmtData(datas[Math.min(Math.max(a.posterDia, 1), datas.length) - 1])}`} />
        <Slider id="pn" rotulo="Postergar despesa: adiar por" valor={a.posterDias} min={0} max={40} passo={1} unidade="d.u." onChange={(v) => set({ posterDias: v })} />
      </Grupo>

      <Grupo titulo="Financiamento">
        <Slider id="av" rotulo="Antecipar recebíveis: valor de face" valor={a.antecipacaoValor} min={0} max={Math.floor(Math.min(20 * MI, totalAR) / MI)} passo={0.5} casas={1} escala={MI} unidade="R$ mi"
          onChange={(v) => set({ antecipacaoValor: v })} dica={`Vende os títulos de maior vencimento (em aberto: ${fmtMi(totalAR)}). Entra à vista no 1º dia, com desconto.`} />
        <Slider id="at" rotulo="Antecipação: taxa" valor={a.antecipacaoTaxaAM} min={0.5} max={6} passo={0.1} casas={1} unidade="% a.m." onChange={(v) => set({ antecipacaoTaxaAM: v })} />
        <Slider id="cv" rotulo="Captação de capital de giro: valor" valor={a.captacaoValor} min={0} max={30} passo={0.5} casas={1} escala={MI} unidade="R$ mi" onChange={(v) => set({ captacaoValor: v })} />
        <Slider id="cd" rotulo="Captação: dia útil de entrada" valor={a.captacaoDia} min={1} max={s.horizonte} passo={1} unidade="dia" onChange={(v) => set({ captacaoDia: v })} dica={`Data: ${fmtData(datas[Math.min(Math.max(a.captacaoDia, 1), datas.length) - 1])}`} />
        <Slider id="ct" rotulo="Captação: taxa" valor={a.captacaoTaxaAM} min={0.5} max={6} passo={0.1} casas={1} unidade="% a.m." onChange={(v) => set({ captacaoTaxaAM: v })} />
        <Slider id="cp" rotulo="Captação: prazo" valor={a.captacaoPrazoDU} min={5} max={126} passo={1} unidade="d.u." onChange={(v) => set({ captacaoPrazoDU: v })} dica="Principal + juros no vencimento." />
      </Grupo>

      <Grupo titulo="Caixa mínimo">
        <Slider id="cm" rotulo="Caixa mínimo" valor={a.caixaMinimo} min={5} max={30} passo={0.5} casas={1} escala={MI} unidade="R$ mi" onChange={(v) => set({ caixaMinimo: v })} />
      </Grupo>
    </div>
  );

  return (
    <div className="space-y-5">
      <Titulo sub="Mexa nas alavancas e veja como o risco de caixa muda em relação à base. O estado fica no link, então dá para compartilhar o cenário.">
        Cenários
      </Titulo>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">{controles}</div>
        <div className="order-1 lg:order-2">{resultados}</div>
      </div>
    </div>
  );
}
