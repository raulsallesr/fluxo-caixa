import type { DadosSim, ParamsSim, ResultadoSim } from "./simulador";

/** Protocolo tipado entre a UI e o Web Worker. */
export type MsgEntrada =
  | { tipo: "init"; dados: DadosSim }
  | { tipo: "simular"; id: number; params: ParamsSim };

export type MsgSaida =
  | { tipo: "pronto" }
  | { tipo: "resultado"; id: number; resultado: ResultadoSim; ms: number }
  | { tipo: "erro"; id: number; mensagem: string };
