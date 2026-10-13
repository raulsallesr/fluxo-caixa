# Fôlego — previsão de fluxo de caixa com Monte Carlo

**PT** · [EN](#english)

Projeto de portfólio: o fluxo de caixa que eu montava em Excel na tesouraria, refeito como um
app web que **projeta o caixa em distribuição (faixas, não um número só)**, mostra **quando o caixa
tende a furar o mínimo** e deixa simular **cenários** na hora.

> Empresa **fictícia** (Distribuidora Maré Alta S.A.), dados **100% sintéticos**. Projeto
> educacional, sem relação com nenhum empregador, e não é recomendação financeira.

## O que tem

| Tela | O que responde |
|---|---|
| **Hoje** | Saldo inicial, entradas/saídas projetadas × realizadas, saldo final esperado × realizado, com drill-down categoria → subcategoria. A projeção de cada dia é a "safra" feita no dia útil anterior. |
| **Projeção** | Fan chart do saldo (P5–P95) para 13 semanas, probabilidade de ficar abaixo do caixa mínimo por dia, data provável de ruptura e Cash-at-Risk. |
| **Cenários** | Atraso de clientes, inadimplência, choque de vendas, prorrogação de fornecedores, antecipação de recebíveis, captação de capital de giro e caixa mínimo. O gráfico recalcula no navegador; o link guarda o cenário. |
| **Entenda** | Metodologia e resultado do backtest. |

## Como projeta (resumo; detalhes em [`docs/METODOLOGIA.md`](docs/METODOLOGIA.md))

1. **Método direto** para o que já é conhecido: títulos a receber e a pagar em aberto e a agenda de
   recorrentes (folha, encargos, tributos, aluguel, dívida).
2. **Curva de pagamento empírica** por segmento (atraso em dias úteis e probabilidade de perda) decide
   *quando* cada título em aberto vira caixa, condicionada ao tempo que já está atrasado.
3. **Processo de Poisson sazonal** para faturas e compras ainda não emitidas.
4. **Monte Carlo** (Python para validar, TypeScript no navegador para simular) em vez de um valor único.

## Backtest (data-base 13/10/2026, 12 origens, horizonte de 13 semanas)

Comparado ao método que eu usava na época ("média do passado"):

| Métrica | Modelo | Média do passado |
|---|---|---|
| Erro das entradas semanais (WAPE) | 11,8% | 16,0% |
| Erro das saídas semanais (WAPE) | 7,6% | 17,4% |
| Erro do saldo projetado (relativo) | 5,8% | 16,4% |
| Cobertura da faixa P10–P90 (alvo 80%) | 78% | — |

Os números são reproduzíveis com `python -m engine.exportar`. As entradas *diárias* seguem ruidosas
(WAPE 51% contra 59%): uma fatura grande atrasar um dia é imprevisível; a previsão é boa em semanas.

## Rodando

```bash
python -m venv .venv && .venv/Scripts/activate      # Windows; em Linux/Mac: source .venv/bin/activate
pip install -e . pytest pytest-cov ruff
python -m engine.exportar                            # gera web/public/data/snapshot.json
cd web && npm ci && npm run dev
```

Testes: `ruff check . && pytest` (engine) e, em `web/`, `npm run typecheck && npm test`.

Arquitetura: `engine/` (Python: gerador sintético, modelos, backtest, snapshot) → `snapshot.json`
→ `web/` (React + Vite + TypeScript + ECharts, simulação em Web Worker). Estático, sem servidor.

---

## English

Portfolio project: the cash-flow workbook I used to build in Excel at a corporate treasury, rebuilt
as a web app that **forecasts cash as a distribution (bands, not one number)**, shows **when cash is
likely to breach the minimum**, and lets you run **what-if scenarios** instantly.

> **Fictitious** company, **100% synthetic** data. Educational project; not financial advice.

**Method:** (1) direct method for what is already known (open receivables/payables + a calendar of
recurring flows); (2) empirical payment curves per customer segment (delay in business days + loss
probability) decide *when* each open item turns into cash; (3) seasonal Poisson process for invoices
not yet issued; (4) Monte Carlo, in the browser via a Web Worker.

**Backtest** (as-of 2026-10-13, 12 rolling origins, 13-week horizon) vs. a "past average" baseline:
weekly inflow WAPE 11.8% vs 16.0%, weekly outflow WAPE 7.6% vs 17.4%, projected-balance error 5.8% vs
16.4%, P10–P90 coverage 78%. See [`docs/METODOLOGIA.md`](docs/METODOLOGIA.md).

**Run:** see the commands above. Stack: Python (pandas/numpy/pydantic) → `snapshot.json` → React +
Vite + TypeScript + ECharts. Static site, no backend.

License: MIT.
