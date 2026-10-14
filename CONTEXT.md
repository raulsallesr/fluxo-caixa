# CONTEXT — Fôlego (previsão de fluxo de caixa)

## O que é
Projeto de portfólio: previsão de caixa de uma distribuidora fictícia (dados 100% sintéticos).
Motor Python (dados + modelos) → snapshot JSON → web app estático (React/Vite/TS) com
Monte Carlo no navegador. Plano completo: `C:\Users\User\.claude\plans\ol-veja-meu-github-goofy-taco.md`.

## Estado atual (13/10/2026)
- **Engine (Python) pronto**: gerador sintético, curvas de pagamento, Monte Carlo, safras D-1, backtest
  rolling-origin, snapshot v1 (pydantic) via `python -m engine.exportar`. 28+ testes, cobertura ~98%.
- Backtest (12 origens, 13 semanas): WAPE entradas 11,8% vs 16,0% (baseline), saídas 7,6% vs 17,4%,
  saldo 5,8% vs 16,4%, cobertura P10–P90 78%. Sem viés relevante (saídas −2,5%).
- Achado da base: caixa mínimo R$ 12 mi; ~74% de chance de romper em algum dia das 13 semanas, ruptura
  mediana ~dia 50 (dezembro/2026: 13º + IRPJ + distribuição + compras sazonais) — propriedade da empresa sintética.
- **Web pronto** (React/Vite/TS/ECharts, `web/`): 4 páginas (Hoje, Projeção, Cenários, Entenda), simulador
  TS em Web Worker. Gates: typecheck, 29 testes vitest (paridade com Python: maior diferença R$ 234 mil),
  build, e2e Playwright 23/23 (4 viewports, sem overflow, alvos ≥44px). Screenshots em `docs/assets/screens/`.
- **No ar (14/10/2026)**: repo https://github.com/raulsallesr/fluxo-caixa (público) e site
  https://raulsallesr.github.io/fluxo-caixa/ . CI e Deploy verdes; `deploy.yml` regenera o snapshot
  todo dia útil (`--as-of hoje`). README bilíngue e `docs/METODOLOGIA.md` prontos.
- Node 24 instalado (terminal novo para o PATH).

## Bloqueios / decisões do Raul
- Compliance/RH da Fits: confirmar política sobre portfólio público na área de atuação antes do post.
- Nome definitivo ("Fôlego" é provisório).

## Próximo passo
Publicar o post (após compliance); conferir modo escuro; reduzir bundle (786 kB, ECharts)
com import dinâmico. v2: orçado × realizado, upload de CSV, efeito cliente no atraso, copiloto.

## Convenções
Gates: `ruff check .` e `pytest` (cobertura ≥ 85%). Nenhum dado real, nenhum segredo.
