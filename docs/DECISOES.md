# Log de decisões

Formato: data, decisão, motivo, alternativas descartadas. Decisão nova que substitui uma antiga
marca a antiga como "substituída".

## 2026-10-13 · Repositório separado do `financas-pessoais`
- **Decisão:** projeto novo, `fluxo-caixa`, em vez de um módulo dentro do Lastro.
- **Motivo:** o projeto mostra tesouraria corporativa, e o Lastro é finanças pessoais e de investimento.
  Misturar os dois confunde a narrativa para recrutadores. O Lastro também tem regras de coordenação
  pesadas que não cabem aqui.
- **Descartado:** aba nova no Lastro.

## 2026-10-13 · Empresa fictícia, distribuidora de porte médio
- **Decisão:** "Distribuidora Maré Alta S.A. (fictícia)", receita ~R$ 350 mi/ano, 300 clientes em 3 segmentos.
- **Motivo:** é o caso clássico de tesouraria (prazo a receber, fornecedores, folha, impostos, dívida), e rende
  metodologia suficiente. Não usar dado de empresa real evita qualquer vínculo com empregador.
- **Descartados:** fintech de pagamentos (parece dado de trabalho, com risco); empresa SaaS (pouco AR/AP).

## 2026-10-13 · Web estático, sem backend na v1
- **Decisão:** React + Vite + TypeScript, publicado no GitHub Pages. O Monte Carlo roda no navegador.
- **Motivo:** custo zero, sem servidor que hiberna, e o link abre na hora. Dá para compartilhar com recrutador.
- **Descartado:** API FastAPI. Plano gratuito hiberna (~30 s para abrir) e o pago custa ~US$ 5–7/mês.
- **Descartado:** Power BI / Streamlit. O Raul pediu algo "dinâmico e útil de verdade", não um painel de BI.

## 2026-10-13 · Contrato Python → TypeScript por parâmetros, com teste de paridade
- **Decisão:** o Python exporta curvas, carteira e agenda no `snapshot.json`; o navegador simula.
  Um teste compara os quantis do TS com os do Python.
- **Motivo:** um único modelo de referência. A paridade pega erro de porte antes de chegar ao usuário.
- **Resultado:** maior diferença de quantil R$ 234 mil (dia 65, P10), dentro da tolerância.

## 2026-10-13 · Método: direto para o conhecido, curva para o pagamento, Poisson só para o residual
- **Decisão:** AR/AP em aberto e agenda de recorrentes são o método direto. A curva de atraso por segmento
  decide quando cada título vira caixa. Faturas futuras são um Poisson sazonal.
- **Motivo:** a incerteza fica onde ela existe de verdade (quando o cliente paga), e não espalhada no
  total. Isso é o que substitui a "média do passado" da época da Trinus.
- **Descartado:** ETS/ARIMA sobre o saldo. Não entende o que causa a variação. Fica como desafiante futuro.

## 2026-10-13 · Backtest contra "média do passado", não contra modelo sofisticado
- **Decisão:** o baseline é o método que o Raul usava (média das 13 semanas anteriores; no diário, o mesmo
  n-ésimo dia útil dos 3 meses anteriores).
- **Motivo:** é a comparação honesta para o portfólio: "o método antigo errava X, o novo erra Y".

## 2026-10-13 · Escopo da v1: Hoje, Projeção e Cenários
- **Decisão:** entram realizado × projetado com drill-down, projeção probabilística com data de ruptura, e
  simulador what-if. Ficam para a v2: orçado × realizado, upload de CSV, copiloto em linguagem natural.
- **Motivo:** a v1 precisa ser publicável com qualidade. A v2 pode ser um post próprio.

## 2026-10-13 · App em PT-BR, README bilíngue
- **Motivo:** o contexto de tesouraria é brasileiro (feriados, D+1, impostos, CDI). O README em inglês
  atende vagas remotas de empresas de fora.

## 2026-10-13 · Dados de amostra com seed fixa e censura em `as_of`
- **Decisão:** a geração é determinística. Nenhum pagamento depois da data-base aparece nos dados.
- **Motivo:** garante que o backtest não vaze o futuro, e que o resultado seja reproduzível.

## 2026-10-13 · Caixa mínimo de R$ 15 mi → R$ 12 mi
- **Decisão:** mínimo de R$ 12 mi.
- **Motivo:** com R$ 15 mi, a probabilidade de romper era 97%. A demo ficava sempre em risco, e o
  simulador perdia o sentido. Com R$ 12 mi, o risco é gradual (74% em algum dia, ruptura mediana no dia 50).
- **Ressalva:** isso é uma escolha de apresentação. Quem vê o site precisa entender que o mínimo é premissa.

## 2026-10-13 · Nome "Fôlego" provisório
- **Motivo:** curto, com a ideia de folga de caixa. Ainda não foi confirmado.

## 2026-10-14 · Remover referências ao empregador do repositório público
- **Decisão:** trocar o nome do empregador por "empregador" em `CONTEXT.md` e nos posts. Renomear
  `baseline_trinus` para `baseline_media_passado`.
- **Motivo:** o repositório é público, e essas referências tinham sido publicadas no push anterior.
- **Pendente:** o histórico do git ainda contém os nomes antigos. Reescrever o histórico exige aprovação
  explícita, então não foi feito.

## 2026-10-14 · Notas pessoais em repositório privado
- **Decisão:** objetivos de carreira, rotina e estratégia pessoal ficam num repositório privado separado
  (`fluxo-caixa-notas`). O público tem só o que é técnico.
- **Motivo:** o repositório público é visto por recrutadores. Informação pessoal não deve ficar lá.
