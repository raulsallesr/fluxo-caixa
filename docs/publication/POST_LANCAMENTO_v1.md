# Rascunhos de posts — LinkedIn

Antes de publicar: confirmar com compliance/RH da Fits a política sobre portfólio público na área de
atuação, trocar `<LINK>` pelo endereço do GitHub Pages e conferir os números contra o `snapshot.json`
da data (o backtest abaixo é da data-base 13/10/2026).

## Post 1 — lançamento (o "porquê")

Montei o fluxo de caixa de uma empresa no Excel. Projetava olhando o passado: média, sazonalidade
na mão, planilha enorme.

Funcionava. Mas respondia só uma pergunta: *quanto vamos ter?* Nunca *qual a chance de ficarmos no
vermelho, e quando?*

Refiz do zero, como app web (Python + React), com uma empresa fictícia e dados sintéticos:

→ saldo projetado como faixa (P5–P95), não um número só
→ probabilidade diária de o caixa ficar abaixo do mínimo e data provável de ruptura
→ simulador: e se os clientes atrasarem 10 dias? e se eu antecipar recebíveis? O gráfico recalcula na hora
→ realizado × projetado do dia, com a projeção feita no dia útil anterior (sem olhar o futuro)

No backtest, contra o método "média do passado" que eu usava: erro das saídas semanais de 7,6% contra
17,4%, e do saldo projetado de 5,8% contra 16,4%.

Código aberto, sem servidor, abre no celular: <LINK>

Projeto educacional, empresa fictícia, não é recomendação financeira.

#tesouraria #fluxodecaixa #python #dados #finanças

## Post 2 — técnico (o "como")

Por que Monte Carlo no fluxo de caixa?

Contas a receber não pagam no vencimento. Cada título tem uma curva de atraso — e já estar atrasado
muda a chance de pagar amanhã.

O que fiz:
1. Curva empírica de atraso (em dias úteis) por segmento de cliente, com probabilidade de perda
2. Probabilidade condicional exata para cada título em aberto: P(paga em k | não pagou até agora)
3. Faturas ainda não emitidas como processo de Poisson sazonal
4. Agenda determinística para folha, impostos e dívida
5. Milhares de caminhos → quantis do saldo, probabilidade de romper o caixa mínimo, Cash-at-Risk

O simulador roda no navegador (Web Worker, TypeScript) e é testado contra a referência em Python:
os quantis batem dentro de tolerância. Sem backend.

Detalhes e backtest: <LINK>/#/entenda

## Post 3 — o achado (ganho de narrativa)

O modelo da empresa fictícia aponta alta chance de o caixa romper o mínimo em meados de dezembro:
13º, IRPJ, distribuição de lucros e compras de fim de ano caem juntos.

É o tipo de pergunta que o Excel de média móvel nunca me respondeu. No simulador: antecipar um lote de
recebíveis ou captar capital de giro move a data — e dá para ver o custo.

Teste os cenários: <LINK>/#/cenarios
