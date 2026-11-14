# Auditoria de UX do sistema: plano de implementação

Data: 14/11/2026. Escopo: Recepção, Supervisão, Terapeuta e Gestor (nesta ordem), todos os itens de menu.
Critério: regra 5 do `AGENTS.md` (fluidez para o operador) mais as leis de UX (Hick, Fitts, Miller, Jakob, Doherty, Tesler, Pareto, Postel, Zeigarnik, Von Restorff, posição serial, proximidade).
Detalhe e evidência (arquivo:linha) de cada achado: os 5 relatórios desta pasta.

## 1. Como esta auditoria foi feita, e o que ela NÃO prova
- 5 auditores leram o código de cada módulo. **Ninguém abriu o sistema no navegador nem consultou o banco.** Tudo que depende de runtime (largura em celular, contraste, tempo de resposta, RLS) está marcado como lacuna nos relatórios.
- Eu conferi no código 16 achados graves (P0 e P1 mais citados) escolhidos entre os 5 relatórios: **todos se confirmaram**. Os outros ~300 não foram conferidos um a um; trate-os como hipóteses bem fundamentadas, e confira o trecho antes de corrigir.

| Módulo | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Recepção | 1 | 14 | 30 | 11 | 56 |
| Supervisão | 4 | 19 | 25 | 11 | 59 |
| Terapeuta | 2 | 17 | 40 | 11 | 70 |
| Gestor A (BI, NPS, Pessoas, Pacientes) | 2 | 22 | 20 | 9 | 53 |
| Gestor B (Cadastros, Financeiro, Relatórios, Auditoria, Config.) | 4 | 32 | 30 | 10 | 76 |
| **Total** | **13** | **104** | **145** | **52** | **314** |

## 2. O que a auditoria mostrou (padrões, não só lista)
1. **Dado inventado exibido como real.** PDF de reavaliação com paciente, convênio e carteirinha fixos (PTS-01); cartões de NPS Interno com 8.9, 78%, 4.7 e 4.5 escritos no código (NPS-01); documentos da Recepção com horário, mês e total pré-preenchidos (REC-71) e emitente de um perfil de desenvolvimento (REC-70); "IA" da evolução que é modelo de frase e fecha sempre com "boa receptividade" (EVO-01). Em sistema de saúde com assinatura e faturamento, isso é risco de confiança e de convênio, acima de qualquer polimento de menu.
2. **Falha silenciosa e ação irreversível sem confirmação.** Saldo do balanço que perde o erro (HUB-02), "Fechar repasses do mês" no primeiro clique (FIN-02), recusa de reagendamento que apaga o registro sem aviso à família (REA-01), aprovação de faixa sem transação (PES-01), consultas do BI que mostram zero quando falham e nenhum `error.tsx` no Gestor (TRA-03).
3. **Funcionalidade construída e nunca ligada.** `executive-leaks.tsx` e `gestor-cockpit.tsx` (fila de decisão do gestor) sem import; `ReagendamentoDialog` importado e não renderizado; `linkVisitorToPatient` e `createManualCheckinRequest` sem chamador; rotas sem nenhum link (reagendamentos, lista de espera, reuniões, maturidade). Parte do plano é **ligar o que já existe**, que é barato.
4. **A regra 5 e a regra 1 estão violadas de forma repetida.** KPI sem comparativo em ~11 telas do Gestor B, ~14 blocos do BI, Repasse e Minhas Métricas do terapeuta. Falta um componente único (`KpiLine`) para cumprir a regra 1 sem custo visual.
5. **Home que não traz o trabalho.** Supervisão abre sempre em "Agenda 1ª Avaliação", com Caixa de entrada sem ordem de urgência; BI do gestor tem 15 blocos de peso igual.

## 3. Regressão minha (entregue hoje, PR #163): corrigir primeiro
**REC-09 (P0).** O botão "Resolver" da faixa "Precisa de você agora" aponta para `/recepcao/pacientes/pendencias`, que só redireciona para a lista de Pacientes (`pendencias/page.tsx:28-39`). A lista de Pacientes recebe as pendências (`pills`) mas **nenhuma linha abre o diálogo**: ele só abre pelo parâmetro `?abrir=`, que só o Chat gera (`patient-list-client.tsx:264,587`). Resultado: o botão "Resolver" cai numa lista genérica. A faixa conta pendências que o operador não consegue resolver a partir dela. Item 0.1 abaixo.

## 4. Decisões que dependem do dono do projeto (não decido sozinho)
| # | Decisão | Por que importa |
|---|---|---|
| D1 | PTS-02: meta aprovada hoje é gravada como `atingida`. Corrigir exige migração de dados ou novo status. | Muda histórico clínico e o PDF da família. Risco alto. |
| D2 | Autorizações sai do menu? (REC-50 e REC-T01) | Só Autorizações habilita o agendamento (dispara WhatsApp) sem conferência. Tirar sem passar essa conferência para a Fila cria um problema novo. |
| D3 | NPS Interno: esconder a aba ou construir o dado real? | Hoje exibe número falso. Esconder é imediato; construir é projeto. |
| D4 | "Gerar texto com IA" da evolução: remover a conclusão fixa ou ligar IA de verdade? | Texto entra no prontuário assinado. Se for IA real, há custo e LGPD. |
| D5 | Financeiro HUB (acessível só por URL, duplica DRE e Fluxo com números diferentes): manter, fundir ou remover? | Dois números diferentes para a mesma pergunta. |
| D6 | Evolução durante a sessão (HOJ-01): permitir registrar ABA antes do check-out, ou renomear o botão? | Muda a regra de negócio do fluxo clínico. |

## 5. Plano por ondas
Ordem: **gravidade primeiro; dentro de cada onda, na ordem Recepção, Supervisão, Terapeuta, Gestor.** Cada item vira um PR pequeno com testes e o checklist da regra 5 no corpo (cliques da tarefa principal, ação primária, o que saiu). Esforço: S até meio dia, M de 1 a 3 dias, L mais.

### Onda 0: parar de mostrar dado falso e de perder dado (13 P0 mais a regressão)
| Ordem | ID | Ação | Esf. |
|---|---|---|---|
| 0.1 | REC-09 | Ligar as pílulas à linha do paciente (abrir diálogo ao clicar) e corrigir os destinos de "Resolver" na faixa e na home | S |
| 0.2 | PTS-01 | Relatório de Reavaliação: usar dados reais do paciente ou esconder o botão até estar certo | S |
| 0.3 | AGD-01 | "Lembrar" e "Ver PTS": ligar à ação real ou remover (hoje dizem que enviaram e não enviam) | S/M |
| 0.4 | REA-01 | `patients(id, name)` para `full_name`; recusa vira cancelamento com motivo e aviso; menu e selo da fila | M |
| 0.5 | HOJ-01 | Botão "Registrar evolução" que cai em "ainda não realizada" (depende de D6) | M |
| 0.6 | EVO-01 | Tirar a conclusão fixa do texto gerado e pedir confirmação antes de substituir o texto digitado (D4) | S |
| 0.7 | NPS-01 | Esconder os números fixos do NPS Interno (D3) | S |
| 0.8 | PES-01 | Aprovação de faixa em uma transação, com confirmação do impacto em R$ | M |
| 0.9 | CFG-02 | `Math.max` sobre lista vazia: permitir criar a primeira prioridade de 1ª avaliação | S |
| 0.10 | HUB-02 | Mostrar erro e estado de salvamento no saldo do balanço | S |
| 0.11 | FIN-02 | Confirmar com mês e resumo antes de "Fechar repasses do mês" | S |
| 0.12 | CTR-01 | Faturas vencidas de meses anteriores visíveis, com baixa | M |
| 0.13 | PTS-02 | Contador e status de meta validada (aguarda D1) | M |

### Onda 1: Recepção (P1)
Em ordem: REC-70 (emitente do usuário logado), REC-71 (documentos sem dados inventados), REC-03 ("Chegou" fecha o pedido do QR), REC-02 (religar `ReagendamentoDialog`; "Remarcada" propõe novo horário, hoje é vazamento de receita), REC-01 mais REC-40 mais REC-60 (aviso ao vivo no layout e selo no Chat), REC-10 ("Novo paciente" confirma onde o cadastro foi parar), REC-50 e REC-T01 (fechar a transição Fila x Autorizações e enxugar o menu de 7 para 5, após D2), REC-30, REC-41, REC-20. Depois, as pequenas da mesma onda: REC-05, REC-08, REC-12, REC-13, REC-62, REC-63, REC-92.

### Onda 2: Supervisão (P1)
TRV-01 mais TRV-02 mais TRV-03 (home "Hoje" por urgência e contadores em todas as rotas), AGE-01 mais AGE-02, PTS-03 mais PTS-04 ("Validar tudo e aprovar", filtro "A aprovar"), INB-01 mais INB-02, EME-01 mais EME-02 (levar "Aviso Falta Terapeuta" para dentro do módulo), LES-01 mais REU-01 (lista de espera e reuniões no menu).

### Onda 3: Terapeuta (P1)
HOJ-03 (após o check-out, levar à evolução), EVO-02 (carregar intervenções e ABC já salvos), HOJ-04 (`<a href>` para `Link`, alvos de 44 px), HOJ-05, EVO-03 (meta dos 2 minutos: hoje são ~16 a 18 toques), REP-01 e MET-01 (comparativo, regra 1), SUB-04 (`pb-24 md:pb-10` corrige o rodapé de 9 telas), TRV-05 (rascunho local reutilizável) e EVO-05 (fila offline real; L).

### Onda 4: Gestor (P1)
BI-02 (comparar mês parcial com o mesmo intervalo do mês anterior), TRA-03 (`error.tsx` e faixa de "dados parciais"), BI-01 (ligar o cockpit de decisão que já existe), TRV-06 (helper de data no fuso da clínica), FIN-09 mais FIN-03, FIN-12 (recorrência que não repete), CAD-09 (botão que não grava), AUD-01 mais AUD-02 (renomear Auditoria; levar "Pendências escaladas" à home com contador), BI-03 e TRV-07 (`KpiLine` único nas ~25 telas sem comparativo), PES-03 mais PES-02 mais PES-05, PAC-01 mais PAC-02, NPS-05.

### Onda 5: Transversal
`KpiLine` (regra 1 sem custo visual); componente de confirmação para ação de dinheiro e de exclusão (FIN-02, FIN-03, REA-01 usam o mesmo); `ModuleHeader` em celular (3 a 4 linhas de pílulas abaixo de 1024 px, TRA-01); resumo mobile para o dono (BI-05); medir tempo de carregamento do BI (19 consultas, `force-dynamic`, histórico inteiro em JS, BI-06).

### Onda 6: P2 e P3 (97 itens)
Backlog por ID nos relatórios. Fazer em lote por tela, junto com qualquer onda que já mexa na mesma tela.

## 6. Menus: o que muda
- **Recepção (7 itens):** proposta do relatório é 5 (Agenda do dia, Pacientes, Fila de entrada, Chat, Documentos). Chegadas viraria parte da home, Autorizações seria absorvida pela Fila. Depende de D2.
- **Supervisão:** hoje 4 rotas reais sem nenhuma entrada (reagendamentos, lista de espera, reuniões, reuniões/nova); Feriados e QR escondidos dentro de outras telas; "Aviso Falta Terapeuta" leva a outro módulo e a barra some.
- **Terapeuta:** barra de 4 itens está adequada em tamanho (Lei de Miller). Problemas são de profundidade e de alvo de toque, não de quantidade de itens.
- **Gestor:** "Auditoria (LGPD)" esconde Ouvidoria e Facilidade de uso, que não são LGPD; Financeiro esconde Contratos; Pessoas & Desempenho tem aba que joga para Configurações e destaca outro item; `/gestor/maturidade` e Financeiro HUB sem menu.

## 7. Como medir que melhorou
Por onda, no corpo do PR: cliques da tarefa principal antes e depois; quantas ações primárias por tela; rotas sem entrada (meta: zero); KPIs sem comparativo (meta: zero); números fixos no código (meta: zero). Antes da Onda 1, abrir a Recepção real com uma pessoa da operação e cronometrar 3 tarefas (confirmar chegada, registrar falta, habilitar uma família) para ter a linha de base que esta auditoria, feita só lendo código, não tem.
