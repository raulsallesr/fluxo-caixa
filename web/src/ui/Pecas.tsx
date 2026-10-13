import { ReactNode } from "react";

export function Kpi({ rotulo, valor, sub, destaque, testId }: { rotulo: string; valor: ReactNode; sub?: ReactNode; destaque?: "risco" | "ok"; testId?: string }) {
  const cor = destaque === "risco" ? "text-laranja" : destaque === "ok" ? "text-azul" : "text-tx";
  return (
    <div className="card !p-3 sm:!p-4" data-testid={testId}>
      <div className="text-xs font-medium text-tx2">{rotulo}</div>
      <div className={`num mt-1 text-xl font-semibold leading-tight sm:text-2xl ${cor}`}>{valor}</div>
      {sub && <div className="mt-1 text-xs text-tx2">{sub}</div>}
    </div>
  );
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 max-w-3xl text-sm text-tx2">{sub}</p>}
    </div>
  );
}

export function Selo({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "azul" | "laranja" }) {
  const c = tom === "azul" ? "bg-azul/15 text-azul" : tom === "laranja" ? "bg-laranja/15 text-laranja" : "bg-surf2 text-tx2";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${c}`}>{children}</span>;
}
