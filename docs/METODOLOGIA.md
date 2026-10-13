# Metodologia

Todos os dados são sintéticos (`engine/sintetico/`). O objetivo é demonstrar o método, não
representar nenhuma empresa real.

## 1. Empresa fictícia

Distribuidora com receita de ~R$ 350 mi/ano, 300 clientes em três segmentos (grandes contas,
atacado, varejo), 120 fornecedores e dois anos de histórico. Cada segmento tem prazo, atraso e
inadimplência próprios; cada cliente tem um fator de atraso individual. Recorrentes: folha, 13º,
FGTS, INSS, ICMS, PIS/COFINS, IRPJ/CSLL trimestral, aluguel, dívida e distribuição de lucros.
A geração é determinística (seed fixa) e **censurada na data-base**: nenhum pagamento futuro é visível.

## 2. Componentes da projeção

| Componente | Como é tratado |
|---|---|
| Títulos a receber em aberto | Cada título recebe uma data de pagamento sorteada da curva do seu segmento, condicionada ao atraso já acumulado (probabilidade condicional exata). Há também probabilidade de perda. |
| Títulos a pagar em aberto | Mesma lógica, curva própria (quase sempre paga no vencimento). |
| Faturas e compras futuras | Processo de Poisson por dia útil, intensidade sazonal por mês, valor lognormal, prazo empírico; o pagamento segue a mesma curva. |
| Recorrentes | Agenda determinística (contratos e calendário fiscal). Os tributos usam o faturamento do mês anterior: o realizado mais o esperado do restante do mês. |
| Dias úteis | Calendário brasileiro (feriados nacionais). Atrasos são medidos em dias úteis; pagamentos só caem em dias úteis. |

### Curva de pagamento

Para cada segmento, `pmf[k]` = fração dos títulos pagos com `k` dias úteis de atraso (k = 0..90) e
`p_perda` = fração nunca paga. O ajuste usa só títulos vencidos há mais de 130 dias na data de corte,
para que o desfecho seja conhecido. Para um título ainda aberto com atraso `ko`, a probabilidade de
pagar com atraso `kd > ko` é `pmf[kd] / surv[ko]`, em que `surv[k] = 1 − Σ pmf[0..k]` (inclui a perda).
Títulos vencidos há mais de 90 dias corridos são tratados como perda conhecida e saem do estado.

## 3. Saída: distribuição

A simulação produz, para cada um dos 65 dias úteis do horizonte, o saldo em milhares de caminhos.
Dali saem os quantis (P5…P95), a probabilidade de saldo abaixo do caixa mínimo por dia, a
probabilidade de romper no horizonte, a mediana do primeiro dia de ruptura e o **Cash-at-Risk**
(saldo atual menos o P5 do saldo mínimo observado no horizonte).

## 4. "Hoje": realizado × projetado sem trapaça

A projeção de cada dia passado é a **safra do dia útil anterior**: o estado da carteira ao fim de D-1
com um modelo **congelado** numa data anterior à janela (90 dias úteis). Nada do que aconteceu depois
vaza para a projeção. A agenda de recorrentes é conhecida; o desvio vem principalmente dos recebimentos.

## 5. Backtest

*Rolling origin*: 12 origens espaçadas de 10 dias úteis; em cada uma o modelo é reajustado só com
informação disponível naquela data, simula 13 semanas e é comparado com o realizado. O baseline é o
método "média do passado" (média semanal das 13 semanas anteriores; no diário, o mesmo n-ésimo dia útil
dos 3 meses anteriores). Métricas: WAPE semanal de entradas e saídas, erro relativo do saldo e cobertura
das faixas P10–P90 e P5–P95. O teste automatizado exige que o modelo supere o baseline em saídas e saldo.

Limitações: dados sintéticos seguem as premissas do gerador (o modelo "conhece" a família de
distribuições); em dados reais é preciso monitorar quebra de estrutura, sazonalidade nova, concentração
de clientes e eventos extraordinários. Entradas diárias são intrinsecamente ruidosas.

## 6. Contrato Python ↔ TypeScript

`engine/snapshot.py` define o schema (`versao`). O Python exporta parâmetros e carteira; o navegador
simula. O teste de paridade compara os quantis do simulador TS com `projecao_base` (5.000 caminhos em
Python) dentro de tolerância, já que os geradores aleatórios diferem.

## 7. Próximos passos (v2)

Orçado × realizado com decomposição do desvio em prazo × valor, upload de CSV de AP/AR processado
no navegador, efeito cliente-específico no atraso, multimoeda e exposição cambial, e um copiloto em
linguagem natural sobre os cenários.
