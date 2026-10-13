import { Snapshot, VERSAO_SUPORTADA } from "./tipos";

export class ErroSnapshot extends Error {}

/** Valida o essencial do contrato; lança ErroSnapshot com mensagem em pt-BR. */
export function validarSnapshot(x: unknown): Snapshot {
  if (typeof x !== "object" || x === null) throw new ErroSnapshot("Snapshot inválido (não é um objeto).");
  const s = x as Partial<Snapshot>;
  if (s.versao !== VERSAO_SUPORTADA) {
    throw new ErroSnapshot(`Versão do snapshot não suportada: ${String(s.versao)} (esperada ${VERSAO_SUPORTADA}).`);
  }
  const obrig: (keyof Snapshot)[] = [
    "empresa", "as_of", "caixa_minimo", "horizonte", "calendario", "idx_origem", "diario",
    "categorias", "titulos_ar", "titulos_ap", "agenda", "modelo", "projecao_base", "backtest",
  ];
  for (const k of obrig) if (s[k] === undefined || s[k] === null) throw new ErroSnapshot(`Snapshot sem o campo "${k}".`);
  if (!s.diario!.some((l) => !l.futuro)) throw new ErroSnapshot("Snapshot sem dias realizados.");
  return s as Snapshot;
}

export async function carregarSnapshot(url = "./data/snapshot.json", sinal?: AbortSignal): Promise<Snapshot> {
  let r: Response;
  try {
    r = await fetch(url, { signal: sinal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ErroSnapshot("Não foi possível carregar os dados (falha de rede).");
  }
  if (!r.ok) throw new ErroSnapshot(`Não foi possível carregar os dados (HTTP ${r.status}).`);
  return validarSnapshot(await r.json());
}
