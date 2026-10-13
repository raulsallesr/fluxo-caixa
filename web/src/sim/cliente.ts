import type { MsgEntrada, MsgSaida } from "./mensagens";
import { DadosSim, ParamsSim, ResultadoSim, simular } from "./simulador";

export class Cancelado extends Error {
  constructor() {
    super("Simulação substituída por uma mais recente.");
  }
}

interface Pedido {
  id: number;
  params: ParamsSim;
  resolve: (r: ResultadoSim) => void;
  reject: (e: Error) => void;
}

/**
 * Cliente do worker. Só mantém um pedido em execução e o mais recente na fila
 * (pedidos intermediários são cancelados), o que evita empilhar simulações ao arrastar sliders.
 */
export class ClienteSim {
  private worker: Worker | null = null;
  private emExecucao: Pedido | null = null;
  private fila: Pedido | null = null;
  private seq = 0;
  private pronto: Promise<void>;
  private destruido = false;

  constructor(private dados: DadosSim) {
    this.pronto = this.iniciar();
  }

  private iniciar(): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        w.onmessage = (ev: MessageEvent<MsgSaida>) => this.aoReceber(ev.data, resolve);
        w.onerror = () => {
          // sem worker utilizável: cai para a thread principal
          this.worker?.terminate();
          this.worker = null;
          resolve();
          this.drenar();
        };
        this.worker = w;
        w.postMessage({ tipo: "init", dados: this.dados } satisfies MsgEntrada);
      } catch {
        this.worker = null;
        resolve();
      }
    });
  }

  private aoReceber(m: MsgSaida, pronto: () => void) {
    if (m.tipo === "pronto") return pronto();
    const p = this.emExecucao;
    if (!p || p.id !== m.id) return;
    this.emExecucao = null;
    if (m.tipo === "resultado") p.resolve(m.resultado);
    else p.reject(new Error(m.mensagem));
    this.drenar();
  }

  /** Roda a simulação; rejeita com `Cancelado` se for substituída antes de começar. */
  rodar(params: ParamsSim): Promise<ResultadoSim> {
    return new Promise<ResultadoSim>((resolve, reject) => {
      if (this.destruido) return reject(new Cancelado());
      if (this.fila) this.fila.reject(new Cancelado());
      this.fila = { id: ++this.seq, params, resolve, reject };
      void this.pronto.then(() => this.drenar());
    });
  }

  private drenar() {
    if (this.emExecucao || !this.fila || this.destruido) return;
    const p = this.fila;
    this.fila = null;
    this.emExecucao = p;
    if (this.worker) {
      this.worker.postMessage({ tipo: "simular", id: p.id, params: p.params } satisfies MsgEntrada);
      return;
    }
    // fallback síncrono
    setTimeout(() => {
      this.emExecucao = null;
      try {
        p.resolve(simular(this.dados, p.params));
      } catch (e) {
        p.reject(e instanceof Error ? e : new Error(String(e)));
      }
      this.drenar();
    }, 0);
  }

  destruir() {
    this.destruido = true;
    this.fila?.reject(new Cancelado());
    this.fila = null;
    this.worker?.terminate();
    this.worker = null;
  }
}
