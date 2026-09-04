# Cadastro Contínuo de Paciente + Agenda + Convênios — Design

**Data:** 2026-09-04
**Fonte:** PRD §9.1 (cadastro em fluxo contínuo), §9.2 (agenda), §9.3 (autorizações), §14 itens 2/3/8 do backlog Fase 0/1
**Escopo:** três partes encadeadas, nesta ordem de dependência: (1) CRUD de convênios, (2) agenda (calendário visual, dia único, sem recorrência/drag-and-drop), (3) cadastro contínuo de paciente nos 5 estágios do PRD §9.1, usando as duas primeiras.

## Decisões registradas nesta sessão

- **Sem auth funcional ainda** (deferido por decisão do usuário — PRD backlog item "Auth + papéis + RLS" fica para depois). Todas as escritas destas 3 partes passam por Server Actions usando a **service role key** do Supabase, que ignora RLS. Isso foi sinalizado como risco de segurança real (qualquer um com acesso à URL do scaffold escreve no banco de produção) e aceito pelo usuário contra a recomendação. Fica isolado num único módulo `lib/supabase/admin.ts`, nunca importado por código client-side, para ser trocado por escrita autenticada assim que o login existir.
- **Escopo dos 5 estágios completo** (não só lead + pendências), incluindo autorização e "grade montada" — decisão do usuário contra a recomendação inicial de recortar menor.
- **Convênios:** só gestor cria/edita (bate com a RLS já aplicada em `insurers_manage_gestor`); recepção/faturamento só leem. Sem `insurer_price_tables` nesta entrega (tabela de preço por procedimento fica para faturamento).
- **Agenda:** calendário visual (colunas sala × horário) para um dia por vez, sem drag-and-drop, sem recorrência. Decisão do usuário contra a recomendação de lista simples — registrado que isso é a peça de maior risco de escopo das três.

## Arquitetura

Três grupos de rotas Next.js App Router, todas Server Components para leitura + Server Actions para escrita (usando `lib/supabase/admin.ts`, cliente service-role):

```
lib/supabase/admin.ts          -- cliente service-role, único ponto de bypass de RLS
app/gestor/convenios/
  page.tsx                     -- lista de insurers
  actions.ts                   -- createInsurer, updateInsurer (server actions)
  insurer-form.tsx             -- client component (form controlado)
app/recepcao/agenda/
  page.tsx                     -- grade do dia (server component, lê appointments+rooms+profiles)
  actions.ts                   -- createAppointment (captura erro 23P01 do guard)
  day-grid.tsx                 -- client component: grade sala × horário
  appointment-form.tsx         -- client component: modal de criação
app/recepcao/pacientes/
  novo/page.tsx                -- form mínimo de lead (nome, responsável, telefone, origem, queixa)
  actions.ts                   -- createLead
  [id]/page.tsx                -- página do paciente com os 5 estágios
  [id]/stage-actions.ts        -- scheduleEvaluation, markEvaluationDone, registerAuthorization, activatePatient
  pendencias/page.tsx          -- fila de pendências (leads sem retorno, estágio travado > N dias)
components/
  stage-checklist.tsx          -- os 5 estágios visuais, reusado na página do paciente
```

## Modelo de estágios (PRD §9.1, mapeado pro schema real)

| Estágio PRD | Coluna/condição real |
|---|---|
| 1. Lead | `patients.status = 'lead'`, `created_at`, `first_contact_at` |
| 2. Avaliação agendada | `patients.status = 'avaliacao'` + existe `appointments` com `is_evaluation=true` pro paciente |
| 3. Avaliação realizada | a `appointment` de avaliação tem `status='realizada'`; `patients.evaluated_at` preenchido |
| 4. Autorização | `patient_insurance` + `authorizations` criados pro paciente, `authorizations.status` em qualquer valor (pendente conta como "em andamento") |
| 5. Grade montada | primeira `appointments` não-avaliação, não-provisória, `status` != cancelada, criada pro paciente; ao criar, `patients.status` vira `'ativo'` e `first_session_at` é preenchido |

Cada transição é uma Server Action dedicada (`stage-actions.ts`), não uma função genérica de "avançar estágio" — cada estágio tem side effects diferentes (ex: estágio 5 muda `patients.status`, os outros não).

## Fluxo de dados (exemplo: criar sessão na agenda)

1. `appointment-form.tsx` (client) coleta paciente/terapeuta/sala/data-hora/disciplina, chama `createAppointment` (server action).
2. `createAppointment` usa o cliente admin, faz `insert` em `appointments`.
3. Dois guards do banco já existem e podem rejeitar: `appointments_authorization_guard` (trigger, se `status='realizada'` sem guia) e o `EXCLUDE USING gist` (conflito de sala/terapeuta, `sqlstate 23P01`).
4. A action captura o erro pelo `code`/`message` do Postgrest e devolve uma mensagem de erro tipada (`{ error: 'sala_ocupada' | 'terapeuta_ocupado' | 'sem_guia' | 'erro_desconhecido' }`) — nunca expõe a mensagem crua do Postgres na UI.
5. `day-grid.tsx` revalida via `revalidatePath` após sucesso.

## Tratamento de erro

- Toda Server Action retorna `{ success: true, data } | { success: false, error: <código tipado> }` — nunca lança exceção pro client component sem tratamento.
- Erros de constraint do banco (23P01 sobreposição, 23514 CHECK, exceções custom do trigger de guard) são mapeados pra mensagens em português na camada da action, nunca repassados crus.
- Formulários mostram erro inline perto do campo relevante quando possível (ex: sobreposição de horário perto do campo de data/hora).

## Testes

Sem suíte de teste automatizado nesta entrega (é código de aplicação, não schema — os testes pgTAP já cobrem as regras de negócio no banco). Verificação manual via `next dev` + captura de tela, seguindo o mesmo padrão de smoke test do scaffold: cada rota carrega, cada fluxo crítico (criar convênio, criar sessão respeitando o guard, avançar os 5 estágios de um paciente de teste) é exercitado manualmente e documentado no relatório de cada task.

## Fora de escopo (explícito)

- Recorrência de sessões, drag-and-drop na agenda, visão semanal/mensal.
- `insurer_price_tables` (tabela de preço por procedimento).
- Upload de documentos (checklist de documentos do PRD §9.1 fica só como lista textual nesta entrega, sem anexo real — é PRD §9.5/backlog item 6, separado).
- Autenticação real, proteção de rota por papel, RLS respeitada nas escritas (débito técnico já registrado).
- WhatsApp/confirmação D-1 (Fase 1).
