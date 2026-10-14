# Backlog de ideias

Status: **pendente**, **em andamento**, **feito**, **descartado**. Prioridade: alta, média, baixa.

## v2 (prioridade alta)

| Ideia | Prioridade | Status | Notas |
|---|---|---|---|
| Orçado × realizado, com desvio decomposto em prazo (timing) × valor | alta | pendente | É a terceira aba da planilha original da Trinus. Dá um post técnico próprio. |
| Calibrar as bandas para a cobertura nominal (80% e 90%) | alta | pendente | Hoje a cobertura é 78% e 88%. Opções: ajuste conformal ou inflar a dispersão do residual. |
| Correlação entre clientes (fator comum de setor/ciclo) | alta | pendente | Hoje são independentes, o que subestima a cauda. Mais honesto para o risco. |
| Efeito cliente-específico no atraso | média | pendente | Hoje só há segmento e fator. Usar histórico individual com encolhimento (shrinkage). |

## v2 (prioridade média)

| Ideia | Prioridade | Status | Notas |
|---|---|---|---|
| Upload de CSV de AR/AP, processado só no navegador | média | pendente | Dado do usuário não sai da máquina. Precisa de um template de colunas e validação. |
| Copiloto em linguagem natural sobre os cenários (Claude API) | média | pendente | Ex.: "quando o caixa fura se o cliente X atrasar 15 dias?". Tem custo de API, e a resposta precisa vir do simulador, não do modelo de linguagem. |
| Exposição cambial e multimoeda | média | pendente | Liga com a experiência de câmbio. Exigiria curvas de moeda e hedge. |
| Modelo desafiante (ETS) no residual | baixa | pendente | Previsto no plano original. Comparar no backtest antes de adotar. |
| Alerta de ruptura (GitHub Action que abre issue ou e-mail) | baixa | pendente | Útil como demonstração de automação. |

## Pensar fora da caixa (ideias para avaliar)

| Ideia | Status | Notas |
|---|---|---|
| Mapa de calor de "dias de fôlego" por cenário | pendente | Um olhar rápido sobre a sensibilidade do caixa a cada alavanca. |
| Negociação de prazo com fornecedor como simulação ("e se eu pedir +15 dias?") | pendente | Já existe como alavanca. Vale mostrar o custo de oportunidade. |
| Modo "conselho": resumo de uma página, pronto para reunião | pendente | Mesma base, formato de comitê financeiro. |
| Painel de "saúde do modelo": calibração e backtest ao vivo | pendente | Mostra que o modelo é monitorado, não só publicado. |

## Feito

| Ideia | Commit | Notas |
|---|---|---|
| Curva de pagamento por segmento | b34a710 | |
| Monte Carlo no navegador com paridade vs Python | 92c2b0a | |
| Caixa mínimo ajustado para R$ 12 mi | 92c2b0a | Ver `DECISOES.md`. |
| Simulador de cenários com estado na URL | 92c2b0a | Link compartilhável. |

## Descartado

| Ideia | Motivo |
|---|---|
| Power BI | O Raul quer algo dinâmico, não um painel de BI. |
| Backend FastAPI na v1 | Custo e hibernação. Ver `DECISOES.md`. |
