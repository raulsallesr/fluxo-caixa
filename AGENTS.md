# AGENTS.md — Fôlego

Regras para qualquer IA que trabalhe neste repo (Claude, Codex, outras). Estilo herdado do repo
`financas-pessoais` do Raul. Responda em português do Brasil, direto e curto.

## Antes de começar
1. `git pull --ff-only` (se houver remoto) e `git status --short`.
2. Ler `CONTEXT.md` (estado e próximo passo) e `docs/METODOLOGIA.md`.
3. Árvore suja que não é sua = trabalho de outro agente: não sobrescrever nem reverter; ler o diff e perguntar.

## Gates (antes de commit/push)
- Engine: `ruff check .` e `pytest` (cobertura mínima 85%, já no `pyproject.toml`).
- Web: em `web/`, `npm run typecheck`, `npm test`, `npm run build`.
- Verificar números contra a fonte: nunca confiar só no resumo de quem implementou. O backtest tem
  que continuar mostrando o modelo melhor que o baseline "média do passado".

## Regras técnicas
- Núcleo puro (`engine/modelos`, `web/src/sim`) separado de I/O e UI.
- Dados sintéticos e determinísticos (seed fixa); nenhum dado real da empresa do Raul ou de terceiros.
- Ausência de dado = vazio (`None`/"—"), nunca zero. Resultados incertos aparecem como faixa/quantis.
- Nenhum segredo, token ou string de conexão no repo. Texto de produto sem recomendação financeira.
- Datas vêm do relógio (`date`), não de dedução. Commits escopados por caminho, identidade `noreply` do GitHub.
- Atualizar `CONTEXT.md` ao fim de qualquer sessão que mudou o estado.

## Decisões do Raul
Push/publicação, nome definitivo do projeto, divulgação em LinkedIn e qualquer uso de dados reais:
parar e perguntar.
