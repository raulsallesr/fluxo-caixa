import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { carregarSnapshot } from "../dados/carregar";
import type { Snapshot } from "../dados/tipos";
import { ClienteSim } from "../sim/cliente";
import { alavancasBase } from "../sim/alavancas";
import { DadosSim, ResultadoSim, dadosDoSnapshot } from "../sim/simulador";

export const SEED_PADRAO = 2026;
export const N_NAVEGADOR = 2000;

export interface Visao {
  datas: string[];
  quantis: Record<string, number[]>;
  p_abaixo_minimo: number[];
  p_romper_no_horizonte: number;
  primeira_ruptura_p50: number | null;
  cash_at_risk: number;
  caixa_minimo: number;
  n: number;
  origem: "python" | "navegador";
}

export function datasHorizonte(s: Snapshot): string[] {
  return s.calendario.slice(s.idx_origem + 1, s.idx_origem + 1 + s.horizonte);
}

export function visaoDeResultado(s: Snapshot, r: ResultadoSim): Visao {
  return {
    datas: datasHorizonte(s), quantis: r.quantis, p_abaixo_minimo: r.p_abaixo_minimo,
    p_romper_no_horizonte: r.p_romper_no_horizonte, primeira_ruptura_p50: r.primeira_ruptura_p50,
    cash_at_risk: r.cash_at_risk, caixa_minimo: r.caixa_minimo, n: r.n, origem: "navegador",
  };
}

export function visaoDoSnapshot(s: Snapshot): Visao {
  const b = s.projecao_base;
  return {
    datas: b.datas, quantis: b.quantis, p_abaixo_minimo: b.p_abaixo_minimo,
    p_romper_no_horizonte: b.p_romper_no_horizonte, primeira_ruptura_p50: b.primeira_ruptura_p50,
    cash_at_risk: b.cash_at_risk, caixa_minimo: s.caixa_minimo, n: b.n_caminhos, origem: "python",
  };
}

type EstadoDados =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "ok"; snapshot: Snapshot };

interface Ctx {
  snapshot: Snapshot;
  dados: DadosSim;
  cliente: ClienteSim;
  base: Visao;
  baseResultado: ResultadoSim | null;
  recalculando: boolean;
  msBase: number | null;
}

const C = createContext<Ctx | null>(null);

export function useFolego(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error("useFolego fora do provider");
  return c;
}

export function FolegoProvider({ children, carregando, erro }: { children: ReactNode; carregando: ReactNode; erro: (m: string, t: () => void) => ReactNode }) {
  const [estado, setEstado] = useState<EstadoDados>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setEstado({ fase: "carregando" });
    carregarSnapshot("./data/snapshot.json", ac.signal)
      .then((snapshot) => setEstado({ fase: "ok", snapshot }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setEstado({ fase: "erro", mensagem: e instanceof Error ? e.message : "Erro desconhecido ao carregar os dados." });
      });
    return () => ac.abort();
  }, [tentativa]);

  if (estado.fase === "carregando") return <>{carregando}</>;
  if (estado.fase === "erro") return <>{erro(estado.mensagem, () => setTentativa((t) => t + 1))}</>;
  return <SimProvider snapshot={estado.snapshot}>{children}</SimProvider>;
}

function SimProvider({ snapshot, children }: { snapshot: Snapshot; children: ReactNode }) {
  const dados = useMemo(() => dadosDoSnapshot(snapshot), [snapshot]);
  const [cliente, setCliente] = useState<ClienteSim | null>(null);
  const [baseRes, setBaseRes] = useState<ResultadoSim | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    const c = new ClienteSim(dados);
    setCliente(c);
    const t0 = performance.now();
    c.rodar({ n: N_NAVEGADOR, seed: SEED_PADRAO, alavancas: alavancasBase(snapshot.caixa_minimo) })
      .then((r) => {
        if (!vivo.current) return;
        setBaseRes(r);
        setMs(performance.now() - t0);
      })
      .catch(() => undefined);
    return () => {
      vivo.current = false;
      c.destruir();
    };
  }, [dados, snapshot.caixa_minimo]);

  const base = useMemo(() => (baseRes ? visaoDeResultado(snapshot, baseRes) : visaoDoSnapshot(snapshot)), [snapshot, baseRes]);
  if (!cliente) return null;
  return (
    <C.Provider value={{ snapshot, dados, cliente, base, baseResultado: baseRes, recalculando: baseRes === null, msBase: ms }}>
      {children}
    </C.Provider>
  );
}
