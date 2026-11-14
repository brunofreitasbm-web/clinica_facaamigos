# Auditoria: migrar de "Autorizações" para "Fila de entrada" (14/11/2026)

## Context

A recepção opera hoje o fluxo do lead do WhatsApp em `/recepcao/a-autorizar` (Autorizações): conferir documentos, enviar guia ao plano, acompanhar o passo a passo, marcar "Autorizado" e disparar a oferta de 1ª avaliação pelo Twilio. A tela `/recepcao/fila` (Fila de entrada) foi construída como substituta mais limpa. O objetivo é aposentar Autorizações sem quebrar o fluxo. Esta auditoria lista o que a Fila já cobre, o que falta, e o que precisa ser feito antes de esconder o menu antigo.

## Veredito curto

Ainda não dá para desligar Autorizações. O núcleo (passos 1 a 5) existe na Fila e chama as MESMAS server actions, mas há 1 bloqueio de produção e 3 lacunas funcionais que hoje só Autorizações resolve.

Base comum confirmada (não é risco):
- Mesma população de leads: ambas usam `getReceptionQueue` + `isAuthorizationQueueItem` + `dropLeadsWithClosedChat` (`lib/fila/load-fila.ts:23`, `app/recepcao/a-autorizar/page.tsx:38`). Nenhum lead some ao trocar de tela.
- Mesmas ações de escrita: `markGuideSent`, `registerAuthorizedGuide`, `enableDraftScheduling`, `requestMissingDocument`, `openDocumentConversation`, `DraftAdjustButton`, `ReassignOwnerButton`, `MoveToLastButton` (`app/recepcao/fila/fila-next-step.tsx:16-27`, `fila-detail.tsx:19-21`).
- "Plano autorizou" na Fila = mesmo `AuthorizedGuideDialog` → `registerAuthorizedGuide` → `enableDraftScheduling` → `startEvaluationOffer` (template Twilio `agendamento_avaliacao`). Idêntico ao botão "Autorizado" de Autorizações, com uma tela de conferência a mais.
- Leitura de documentos por IA não depende de Autorizações: roda no webhook (`lib/whatsapp-cold-media.ts`) e no pg_cron a cada minuto (`app/api/extractions/process`).
- Duplicidade (regra 3 do AGENTS.md): a mesclagem automática é feita no carregamento da fila, igual nas duas telas.
- Renovação de autorização não pertence a nenhum dos dois menus (fica em Pendências). Fora do escopo.

## Matriz do fluxo (seus 5 passos)

| Passo | Autorizações | Fila de entrada | Situação |
|---|---|---|---|
| 1. Conferir documentos | Pills + arquivos + cobrar documento um a um (`DocumentRequestButtons`) | Lista de documentos com estado + arquivos + "Pedir documentos" em lote | OK, com perda: não dá para cobrar UM documento específico nem um que o sistema não marcou como faltante |
| 2. Enviar ao plano | "Guia enviada ao plano" + **Robô do portal** | "Registrar guia enviada" + "Dados para o portal" com Copiar. **Sem robô** | LACUNA. Produção: 23 envios pelo robô em 30 dias contra 40 guias (mais ou menos metade passa pelo robô; agente visto pela última vez em 10/11) |
| 3. Passo a passo | Pipeline de 4 etapas com gamificação | Trilha de 4 etapas + UM próximo passo + histórico | OK, melhor |
| 4. Autorizado | "Plano autorizou" também com guia pendente; Desfazer autorização; "Retirar habilitação" | "Plano autorizou" só depois de "guia enviada". **Sem Desfazer autorização e sem Retirar habilitação** | LACUNA de recuperação de erro |
| 5. Twilio / oferta | `startEvaluationOffer` + link wa.me manual se falhar | `startEvaluationOffer` + toast de falha + link do Chat | OK |
| Plano negou / pediu mais docs | Não existe | Existe, com Desfazer | **BLOQUEIO**: migration `20261110120000_intake_plan_outcomes.sql` NÃO aplicada em produção (coluna `plan_denied_at` inexistente). O botão devolve "migration pendente" |
| Rejeitar / arquivar com motivo | Só via "Conferir e cadastrar" | Só via "Conferir e cadastrar" | Empate. Ambas exigem sair da tela |

## Avaliação pelas Leis de UX

Autorizações (por que polui):
- Hick: 8 chips de status + 3 dropdowns + 2 modos de visão + 4 quadros recolhíveis antes de escolher um lead.
- Miller / carga cognitiva: o card do lead tem "Pendência a resolver", "Ação para fazer", "Passo a passo", pipeline, missão, conversa e botões de cobrança na mesma rolagem.
- Von Restorff diluído: muitos badges e emojis (🎯 🚀 🏆 ⭐) competem; nada se destaca.
- Bugs que corroem confiança: filtro "Falta RG/Certidão" sempre 0; "Colocar no fim" não reordena a lista.

Fila de entrada (por que é melhor):
- Hick e Tesler: 4 abas por estado e um único próximo passo; o sistema decide o que mostrar.
- Goal-gradient: trilha de 4 etapas mostra quanto falta.
- Postel / prevenção de erro: ação que manda WhatsApp pede conferência; ação reversível tem Desfazer de 8s.
- Doherty: feedback imediato com toast e "Esta família saiu desta aba → Ir para".

Pontos fracos da Fila que a migração precisa corrigir:
- Recuperação de erro (Nielsen #3, Postel): depois de autorizar ou habilitar não há volta na Fila; hoje o operador teria que abrir Autorizações.
- Controle: "Pedir documentos" sempre manda todos os faltantes; sem escolher um.
- Tesler mal aplicado no passo 4: obrigar "Registrar guia enviada" antes de "Plano autorizou" adiciona um clique quando a guia foi enviada fora do sistema. Aceitável, mas vale oferecer "Plano autorizou" também em `send_guide` (o servidor já preenche `guide_sent_at` sozinho).

## Plano recomendado (ordem)

### Fase 0, bloqueio (o dono aplica, fora deste trabalho)
1. O dono do projeto aplica `supabase/migrations/20261110120000_intake_plan_outcomes.sql` no `BD_CLINICA_RH`. Não aplicar daqui. No PR, destacar que "Plano negou / pediu mais documentos" dão erro até isso acontecer.

### Fase 1, paridade mínima na Fila (código, escopo aprovado)
2. **Robô do portal**: renderizar `PortalRobotPanel` (`app/recepcao/pacientes/pendencias/portal-robot-panel.tsx`) no card de próximo passo quando `step.kind === "send_guide"` (interativo) e em `wait_plan` (somente leitura, para ver status/print/confirmar), espelhando `draft-pipeline.tsx:582,593`. O robô já grava `guide_sent_at` sozinho (`lib/portal-robot.ts:115`); o polling de 3s do painel deve chamar `router.refresh()` quando o job vira `enviado`, para o lead mudar de aba. Conferir as props que `draft-pipeline.tsx` passa (`canRequest`, draftId, readOnly) e reaproveitar igual.
3. **Cobrar documento específico**: no bloco "Documentos" de `fila-detail.tsx`, botão "Pedir este" nas linhas com estado Falta/Conferir, chamando `requestMissingDocument` pelo mesmo caminho de conferência (`ask_documents`, política "confirm") já usado em `fila-next-step.tsx`.
4. **"Plano autorizou" também em `send_guide`** como ação secundária, abrindo o mesmo `AuthorizedGuideDialog` + conferência (`saveAuthorized`). O servidor já preenche `guide_sent_at` quando vazio.
5. Desfazer autorização / Retirar habilitação: **não entra** (decisão do dono: raro, resolvido por fora). Risco registrado: quando Autorizações sair do menu, não haverá caminho de UI para isso.

### Fase 2, transição (parte 1, escopo aprovado)
6. `components/recepcao-nav.tsx`: "Fila de entrada" acima de "Autorizações"; badge de contagem migra para a Fila (mesma conta de `app/recepcao/layout.tsx:33`).
7. Links que hoje levam para Autorizações passam a levar para `/recepcao/fila?item=`: redirect de `app/recepcao/pacientes/pendencias/page.tsx:27`, "← Voltar para Autorizações" em `/recepcao/pre-cadastros/[draftId]`, e demais `href="/recepcao/a-autorizar"` encontrados por grep (gestor-cockpit, chat deep-link etc.), conferindo que o `item` usado é aceito por `findFilaItem`.
8. Autorizações continua acessível pelo menu. Esconder e redirecionar fica para um PR posterior, depois de uma semana de uso.

### Fora de escopo, registrar
- Bugs de Autorizações que morrem com a tela (filtro RG, ordenação por `due_at`).
- "Retirar habilitação" não cancela oferta viva em `evaluation_offers` (vale para as duas telas).
- `reassignQueueItem` não revalida `/recepcao/fila` e o botão não chama `router.refresh()`: dono fica desatualizado até recarregar.

## Situação após o PR desta auditoria

- Feito: robô do portal na Fila, "Pedir este" por documento, "Plano já autorizou" no passo da guia, Fila primeiro no menu com o selo de contagem, links (pré-cadastro, Pendências, Chat) apontando para a Fila, revalidação da Fila ao reatribuir dono.
- Pendente do dono: aplicar `20261110120000_intake_plan_outcomes.sql` em produção.
- Decisão do dono: sem "Desfazer autorização" e "Retirar habilitação" na Fila. Quando Autorizações sair do menu, não haverá caminho de UI para essas duas ações.
- Próximo passo: depois de uma semana de uso, esconder Autorizações e redirecionar `/recepcao/a-autorizar?item=` para `/recepcao/fila?item=`.
