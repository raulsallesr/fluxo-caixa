# CONTEXT — Fôlego (previsão de fluxo de caixa)

## O que é
Projeto de portfólio: previsão de caixa de uma distribuidora fictícia (dados 100% sintéticos).
Motor Python (dados + modelos) → snapshot JSON → web app estático (React/Vite/TS) com
Monte Carlo no navegador. Plano completo: `C:\Users\User\.claude\plans\ol-veja-meu-github-goofy-taco.md`.

## Estado atual (13/10/2026)
- M0: repo local, `.venv` (Python 3.12, fora do OneDrive), calendário BR (dias úteis, 5º dia útil, ajuste vetorizado).
- Gerador sintético pronto (`engine/sintetico/`): 300 clientes em 3 segmentos (perfis de atraso e
  inadimplência distintos), 120 fornecedores, ~14,8k títulos de AR e ~6k de AP em 2 anos, recorrentes
  (folha, 13º, FGTS/INSS, ICMS, PIS/COFINS, IRPJ trimestral, aluguel, dívida, distribuição de lucros).
  Receita ~R$ 350 mi/ano, caixa oscila entre ~R$ 22 e 41 mi. Tudo censurado em `as_of` (sem vazar futuro).
- 13 testes, cobertura 100%, ruff limpo. Node LTS 24 instalado (PATH só vale em terminal novo).

## Bloqueios
- Node instalado via winget; abrir terminal novo para o PATH valer.
- Repo remoto no GitHub não criado (`gh` ausente) — push só com confirmação do Raul.
- Nome definitivo do projeto em aberto ("Fôlego" provisório).
- Confirmar com compliance/RH da Fits sobre publicar portfólio na área de atuação.

## Próximo passo
Schema pydantic do snapshot + `exportar.py` (M1); depois "projetado" por safras (método direto) para a visão Hoje;
depois schema pydantic do snapshot e `exportar.py`.

## Convenções
Gates: `ruff check .` e `pytest` (cobertura ≥ 85%). Nenhum dado real, nenhum segredo.
