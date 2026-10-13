# CONTEXT — Fôlego (previsão de fluxo de caixa)

## O que é
Projeto de portfólio: previsão de caixa de uma distribuidora fictícia (dados 100% sintéticos).
Motor Python (dados + modelos) → snapshot JSON → web app estático (React/Vite/TS) com
Monte Carlo no navegador. Plano completo: `C:\Users\User\.claude\plans\ol-veja-meu-github-goofy-taco.md`.

## Estado atual (13/10/2026)
- M0 iniciado: repo local, venv (.venv, Python 3.12), `engine/calendario.py` + testes (cobertura 100%).

## Bloqueios
- Node/npm não instalado (necessário a partir do M1).
- Repo remoto no GitHub não criado (`gh` ausente) — push só com confirmação do Raul.
- Nome definitivo do projeto em aberto ("Fôlego" provisório).
- Confirmar com compliance/RH da Fits sobre publicar portfólio na área de atuação.

## Próximo passo
`engine/sintetico/` (clientes, fornecedores, recorrentes, gerar.py com seed fixa) + testes de sanidade;
depois schema pydantic do snapshot e `exportar.py`.

## Convenções
Gates: `ruff check .` e `pytest` (cobertura ≥ 85%). Nenhum dado real, nenhum segredo.
