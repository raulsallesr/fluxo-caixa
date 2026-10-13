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
- Achado da base: ~97% de chance de romper o caixa mínimo (R$ 15 mi) até meados de dezembro/2026
  (13º + IRPJ + distribuição + compras sazonais) — propriedade real da empresa sintética.
- **Web (React/Vite/TS/ECharts)**: em construção por agente em `web/` (4 páginas, simulador TS em
  Web Worker, testes de paridade vs Python). Ver status no commit seguinte.
- CI (`ci.yml`) e deploy no GitHub Pages (`deploy.yml`, cron diário com `--as-of hoje`) escritos, ainda
  sem remoto. README bilíngue e `docs/METODOLOGIA.md` prontos.
- Node 24 instalado (terminal novo para o PATH).

## Bloqueios / decisões do Raul
- Criar o repo no GitHub e habilitar Pages (Settings → Pages → Source: GitHub Actions); `gh` ausente.
  Push só com confirmação.
- Nome definitivo ("Fôlego" é provisório).
- Compliance/RH da Fits: confirmar política sobre portfólio público na área de atuação antes do post.

## Próximo passo
Fechar o web (gates + screenshots), regenerar o snapshot, commit; criar repo remoto; rascunhos de posts
em `docs/publication/`. v2: orçado × realizado, upload de CSV, efeito cliente no atraso, copiloto.

## Convenções
Gates: `ruff check .` e `pytest` (cobertura ≥ 85%). Nenhum dado real, nenhum segredo.
