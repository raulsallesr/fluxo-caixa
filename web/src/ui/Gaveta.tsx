import { ReactNode, useEffect, useRef } from "react";

/** Painel modal (bottom sheet no mobile, lateral no desktop). Esc fecha; devolve o foco ao fechar. */
export function Gaveta({ aberta, titulo, onFechar, children }: { aberta: boolean; titulo: string; onFechar: () => void; children: ReactNode }) {
  const fechar = useRef<HTMLButtonElement>(null);
  const antes = useRef<Element | null>(null);

  useEffect(() => {
    if (!aberta) return;
    antes.current = document.activeElement;
    fechar.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("keydown", k);
      if (antes.current instanceof HTMLElement) antes.current.focus();
    };
  }, [aberta, onFechar]);

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-40" data-testid="gaveta">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border border-borda bg-surf shadow-xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[520px] md:rounded-none md:rounded-l-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-borda px-4 py-3">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button ref={fechar} className="btn" onClick={onFechar} aria-label="Fechar">
            Fechar
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}
