# Retomada (leia primeiro)

Este arquivo permite continuar o projeto em qualquer máquina, sem depender do histórico de chat.

## Onde está
- Repositório: https://github.com/raulsallesr/fluxo-caixa (público, MIT)
- Site: https://raulsallesr.github.io/fluxo-caixa/
- Pasta local (PC de casa): `C:\Users\User\Documents\fluxo-caixa`
- Último commit no momento deste arquivo: ver `git log --oneline | head -1`

## Estado
- Motor Python: gerador sintético, curvas de pagamento, Monte Carlo, safras D-1, backtest, snapshot v1.
  28 testes, cobertura 98%, `ruff` limpo.
- Front-end React/Vite/TypeScript: 4 telas (Hoje, Projeção, Cenários, Entenda). Simulador em Web Worker.
  29 testes vitest, 23 e2e Playwright, build ok.
- CI e deploy no GitHub Actions: verdes. O deploy regenera o snapshot todo dia útil.
- Posts de LinkedIn: rascunhos em `docs/publication/`, **não publicados**.

## Retomar em outra máquina
Pré-requisitos: Git, Python 3.12, Node 22+ (no Windows, abra um terminal novo depois de instalar).

```bash
git clone https://github.com/raulsallesr/fluxo-caixa
cd fluxo-caixa
python -m venv .venv
.venv/Scripts/activate            # Windows; Linux/Mac: source .venv/bin/activate
pip install -e . pytest pytest-cov ruff
python -m engine.exportar         # regenera web/public/data/snapshot.json
```

```bash
cd web
npm ci
npm run dev
```

Gates antes de qualquer commit:

```bash
ruff check . && pytest
```

```bash
cd web && npm run typecheck && npm test && npm run build
```

Regra do repositório: `.venv` e `node_modules` ficam fora de pastas sincronizadas (OneDrive causa erros de instalação).

## Números de referência (snapshot local, data-base 13/10/2026)
- Caixa mínimo: R$ 12 mi.
- Probabilidade de romper o mínimo em algum dia das 13 semanas: 74%.
- Ruptura mediana: dia útil 50 do horizonte (dezembro/2026).
- Backtest, 12 origens: erro semanal de saídas 7,6% (média do passado: 17,4%); entradas 11,8% (16,0%);
  erro do saldo 5,8% (16,4%).
- Cobertura observada: P10–P90 78,2% (alvo 80%); P5–P95 88,5% (alvo 90%).

## Próximos passos, em ordem
1. Abrir o site no celular e no desktop, e conferir o modo escuro (ainda não verificado).
2. Confirmar com compliance/RH do empregador a política sobre portfólio público. Sem isso, não publicar posts.
3. Decidir o nome definitivo do projeto ("Fôlego" é provisório). Trocar em título, README, site e posts.
4. Publicar o Post 1 (lançamento) e, depois, o Post 2 (técnico). Os números dos posts são da data-base 13/10.
5. Reduzir o bundle (786 kB; o ECharts é quase tudo). Caminho: import dinâmico das páginas.
6. Calibrar as bandas para a cobertura nominal (ver `docs/IDEIAS.md`).
7. Começar a v2 pelo item de maior valor para o portfólio (ver `docs/IDEIAS.md`, prioridade).

## Limitações conhecidas
- Dados 100% sintéticos. O modelo conhece a família de distribuições que gerou os dados, então o backtest
  é otimista em relação a dados reais. Isso aparece na página Entenda.
- Entradas diárias são ruidosas (WAPE 51% contra 59% do método antigo). O modelo acerta semanas, não dias.
- Clientes são independentes. Na realidade há correlação, e isso alarga a cauda de risco.
- Poisson usa aproximação normal para λ ≥ 30. Só afeta choques de vendas altos.
- O `web/public/data/snapshot.json` versionado é a cópia de 13/10. O site publica a versão gerada pelo CI.
- O CI usa `date.today()` em UTC. Perto da meia-noite, o `as_of` pode ser o dia seguinte ao local.
- Não testei o site publicado em um celular real.

## Coordenação entre IAs e máquinas
Regras em `AGENTS.md`. Resumo: ler `CONTEXT.md` e este arquivo antes de editar; gates verdes antes do
push; nada de segredo, dado real ou nome de empregador no repositório público; decisões do Raul são paradas
para pergunta.

## Onde ficam as outras anotações
- `CONTEXT.md`: estado curto e próximo passo (atualizado ao fim de cada sessão).
- `docs/DECISOES.md`: cada decisão, o motivo e as alternativas descartadas.
- `docs/IDEIAS.md`: backlog de ideias com status.
- `docs/CHANGELOG.md`: marcos e commits.
- `docs/METODOLOGIA.md`: como o modelo funciona.
- Notas pessoais e de carreira: repositório privado separado, não público.
