import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { fmtData } from "../dados/formato";
import { useFolego } from "./contexto";

const ITENS = [
  { to: "/hoje", rotulo: "Hoje", d: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { to: "/projecao", rotulo: "Projeção", d: "M3 17l5-6 4 3 8-9M3 21h18" },
  { to: "/cenarios", rotulo: "Cenários", d: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" },
  { to: "/entenda", rotulo: "Entenda", d: "M12 17v-1c0-2 3-2 3-5a3 3 0 10-6 0M12 21h.01M12 3a9 9 0 100 18 9 9 0 000-18z" },
];

function Icone({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function Marca() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-azul" style={{ color: "rgb(var(--onazul))" }} aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M3 15c3-7 6 3 9-3s6-2 9-5" /></svg>
      </span>
      Fôlego
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { snapshot } = useFolego();
  return (
    <div className="min-h-screen">
      <header className="border-b border-borda bg-surf">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Marca />
            <p className="mt-0.5 truncate text-xs text-tx2" data-testid="empresa">{snapshot.empresa}</p>
          </div>
          <div className="text-right text-xs text-tx2">
            <div>Data-base</div>
            <div className="num text-sm font-semibold text-tx" data-testid="data-base">{fmtData(snapshot.as_of)}</div>
          </div>
        </div>
        <nav aria-label="Principal" className="mx-auto hidden max-w-6xl gap-1 px-4 md:flex">
          {ITENS.map((i) => (
            <NavLink key={i.to} to={i.to}
              className={({ isActive }) => `-mb-px flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm font-medium ${isActive ? "border-azul text-azul" : "border-transparent text-tx2 hover:text-tx"}`}>
              <Icone d={i.d} />{i.rotulo}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-10">{children}
        <footer className="mt-10 border-t border-borda pt-4 text-xs text-tx2" data-testid="rodape">
          Projeto educacional/portfólio. Dados 100% sintéticos de empresa fictícia. Não é recomendação financeira.
        </footer>
      </main>
      <nav aria-label="Principal (mobile)" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-borda bg-surf pb-[env(safe-area-inset-bottom)] md:hidden">
        {ITENS.map((i) => (
          <NavLink key={i.to} to={i.to}
            className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? "text-azul" : "text-tx2"}`}>
            <Icone d={i.d} />{i.rotulo}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Carregando() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center" role="status" aria-live="polite">
      <div><Marca /><p className="mt-3 text-sm text-tx2">Carregando dados…</p></div>
    </div>
  );
}

export function Erro({ mensagem, tentar }: { mensagem: string; tentar: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center" role="alert">
      <div className="max-w-md">
        <Marca />
        <p className="mt-3 font-medium">Não foi possível exibir os dados.</p>
        <p className="mt-1 text-sm text-tx2">{mensagem}</p>
        <button className="btn btn-primario mt-4" onClick={tentar}>Tentar de novo</button>
      </div>
    </div>
  );
}
