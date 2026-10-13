/// <reference lib="webworker" />
import type { MsgEntrada, MsgSaida } from "./mensagens";
import { DadosSim, simular } from "./simulador";

let dados: DadosSim | null = null;
const ctx = self as unknown as DedicatedWorkerGlobalScope;
const enviar = (m: MsgSaida) => ctx.postMessage(m);

ctx.onmessage = (ev: MessageEvent<MsgEntrada>) => {
  const m = ev.data;
  if (m.tipo === "init") {
    dados = m.dados;
    enviar({ tipo: "pronto" });
    return;
  }
  if (!dados) {
    enviar({ tipo: "erro", id: m.id, mensagem: "Worker sem dados inicializados." });
    return;
  }
  try {
    const t0 = performance.now();
    const resultado = simular(dados, m.params);
    enviar({ tipo: "resultado", id: m.id, resultado, ms: performance.now() - t0 });
  } catch (e) {
    enviar({ tipo: "erro", id: m.id, mensagem: e instanceof Error ? e.message : String(e) });
  }
};
