# Sessão: check-in/check-out, status com motivo e autor — Design

**Data:** 2026-09-04
**Origem:** PRD §14 backlog item 4 ("Sessão: check-in, status, motivo, autor"), regras em §9.2, home da recepção em §9.1.
**Depende de:** agenda visual já implementada (`app/recepcao/agenda/`), seed de dev (`lib/supabase/admin.ts`, `lib/constants.ts`, `docs/superpowers/scratch/seed-dev-data.sql`).
**Não inclui:** evolução clínica (item 5 do backlog — próximo spec), sugestão automática de horário vago na remarcação (Fase 1), confirmação manual/D-1 de presença via WhatsApp (Fase 1) — decisão explícita, ver seção de escopo.

## Contexto

A agenda (`/recepcao/agenda`) hoje só lê e cria sessões (`status` sempre nasce `agendada`). Não há como a recepção registrar que o paciente chegou, saiu, faltou ou foi cancelado — os campos já existem no schema (`checkin_at`, `checkout_at`, `cancelled_by`, `cancelled_at`, `cancel_reason`) mas nenhuma UI/Server Action os grava. Sem isso, nenhuma sessão nunca chega a `status='realizada'` pela agenda normal (só a avaliação, via `markEvaluationDone`, que já existe e fica fora do escopo desta entrega), e as métricas que dependem de sessão realizada (`no_show_rate`, `occupancy_rate`, faturamento) ficam sempre zeradas.

## Escopo (decisões tomadas com o usuário)

- **Autor da ação (`cancelled_by`):** um profile fixo `role='recepcao'` criado no seed de dev, mesmo padrão do `DEV_CLINIC_ID` já usado em todas as outras Server Actions. Débito técnico já registrado no projeto (sem auth real ainda) — autoria fica correta no banco assim que login existir, sem mudar o desenho da tabela.
- **Interação na agenda:** clicar no cartão da sessão abre um painel lateral com os dados da sessão e as ações válidas pro estado atual — não bloco de botões dentro do cartão pequeno da grade.
- **Remarcação:** só marca `status='remarcada'` com motivo+autor. A recepção cria a nova sessão manualmente pelo formulário de agendamento que já existe (`AppointmentForm`). Sugestão automática de horário vago é Fase 1 (§8), não entra aqui.
- **Confirmar presença (`confirmed_at`/`confirmed_via`):** fica fora desta entrega. Entra junto com a confirmação D-1 via WhatsApp (Fase 1), quando faz sentido ter as duas formas de confirmar juntas.

## Máquina de estados (na UI — não é um novo valor de `status`)

`appointments.status` continua com os 8 valores já existentes no schema. O painel deriva um "estado de UI" a partir de `status` + `checkin_at` + `checkout_at`:

| Estado de UI | Condição | Ações disponíveis |
|---|---|---|
| Aguardando chegada | `status in (agendada, confirmada)` e `checkin_at is null` | Check-in · Falta/Cancelar |
| Em atendimento | `checkin_at` setado e `checkout_at is null` | Check-out |
| Realizada | `status = 'realizada'` | nenhuma (terminal — link futuro "registrar evolução", spec seguinte) |
| Falta/cancelada/remarcada | `status in (falta_familia, cancelada_familia, cancelada_terapeuta, cancelada_clinica, remarcada)` | nenhuma (terminal, mostra motivo/autor/hora) |

Regra importante: **check-out grava `checkout_at` e transiciona `status → 'realizada'` na mesma ação.** É essa transição que aciona o trigger `appointments_authorization_guard` já existente no banco (exige `authorization_id` válido, autorização `ativa`, dentro da vigência, com sessões restantes) — a Server Action precisa mapear as exceções desse trigger pra mensagens em português, não deixá-las crua na UI.

Nota de consistência conhecida e aceita: `markEvaluationDone` (já implementado, usado na página do paciente) transiciona avaliação pra `realizada` sem passar por `checkin_at`/`checkout_at`. As duas rotas (evolução de estágio do paciente vs. agenda geral) continuam coexistindo sem conflito — uma sessão de avaliação também aparece na agenda e pode, a partir de agora, ser check-in/check-out normalmente pelo painel novo. Não é necessário unificar os dois fluxos nesta entrega.

## UI

**`app/recepcao/agenda/day-grid.tsx`** — cartão de sessão vira clicável (`onClick` abre o painel); precisa virar client component (hoje é server-renderable, sem estado). Extrair o estado do painel aberto (`selectedAppointmentId`) pra um wrapper client novo, já que `page.tsx` continua Server Component buscando os dados.

**`app/recepcao/agenda/appointment-panel.tsx`** (novo, client component) — recebe a sessão selecionada (mesmo shape de `AgendaAppointment`, com os campos novos `checkinAt`, `checkoutAt`, `cancelReason`, `cancelledBy` adicionados ao tipo) e renderiza:
- Cabeçalho: paciente, terapeuta, sala, horário.
- Estado atual (rótulo do estado de UI da tabela acima).
- Ações válidas pro estado, como formulários/botões (`StageActionForm`-like, reaproveitando o padrão de pending/error já usado em `stage-action-form.tsx`).
- Se terminal negativo: mostra motivo, autor (nome), hora do cancelamento.

Formulário de **Falta/Cancelar**: select de status alvo (rótulos em português: "Falta da família" → `falta_familia`, "Cancelada pela família" → `cancelada_familia`, "Cancelada pelo terapeuta" → `cancelada_terapeuta`, "Cancelada pela clínica" → `cancelada_clinica`, "Remarcada" → `remarcada`) + select de motivo (lista fechada do §9.2: doença da criança, transporte, esquecimento, viagem, sem justificativa, terapeuta indisponível, sala indisponível, clínica fechada, outro) + campo de texto condicional quando motivo = "outro".

## Server Actions

Novo arquivo `app/recepcao/agenda/session-actions.ts`:

```typescript
type ActionResult = { success: true } | { success: false; error: string };

checkIn(appointmentId: string): Promise<ActionResult>
// grava checkin_at = now(); só permitido se checkin_at ainda for null e status não for terminal.

checkOut(appointmentId: string): Promise<ActionResult>
// grava checkout_at = now() e status = 'realizada' no mesmo update.
// mapeia exceções do trigger appointments_authorization_guard:
//   "exige authorization_id"      -> "Sessão sem autorização vinculada — não é possível fechar."
//   "não está ativa"              -> "Autorização não está mais ativa."
//   "fora da vigência"            -> "Sessão fora da vigência da autorização."
//   "sem sessões restantes"       -> "Autorização sem sessões restantes."
//   default                        -> "Não foi possível fechar a sessão. Tente de novo."

markMissedOrCancelled(appointmentId: string, formData: FormData): Promise<ActionResult>
// lê target_status, reason, reason_other do formData; valida contra a lista fechada;
// grava status, cancel_reason (= reason, ou reason_other quando reason='outro'),
// cancelled_by = DEV_RECEPTION_PROFILE_ID, cancelled_at = now().
```

Todas chamam `revalidatePath("/recepcao/agenda")` ao final, mesmo padrão das outras actions do projeto.

## Dados de desenvolvimento

Adicionar ao seed idempotente (`docs/superpowers/scratch/seed-dev-data.sql`, mesmo arquivo da Task 1 já commitada — `on conflict do nothing`, seguro rodar de novo):

```sql
insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000004', 'recepcao@facaamigos.dev')
on conflict do nothing;

insert into profiles (id, clinic_id, role, full_name, active) values
  ('c1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'recepcao', 'Recepção FaçaAmigos', true)
on conflict do nothing;
```

Nova constante em `lib/constants.ts`: `DEV_RECEPTION_PROFILE_ID = "c1000000-0000-0000-0000-000000000004"`.

## Testes manuais (critério de aceite desta entrega)

1. Clicar numa sessão `agendada` sem `checkin_at` → painel mostra "Aguardando chegada" com ação Check-in.
2. Check-in → painel passa a mostrar "Em atendimento" com ação Check-out; grade (se recarregada) continua mostrando o mesmo `status` (não muda ainda).
3. Check-out → `status` vira `realizada`, painel mostra terminal; se o paciente não tiver autorização ativa, a mensagem de erro aparece em português, sem stacktrace/sqlstate cru.
4. Falta/Cancelar numa sessão `agendada` → escolher "Falta da família" + motivo "esquecimento" → grava, painel mostra motivo e autor "Recepção FaçaAmigos".
5. Sessão terminal (realizada ou cancelada) não mostra mais nenhuma ação no painel.
6. Rodar o seed de novo (idempotente) não duplica o profile de recepção.

## Placeholder scan

Nenhum "TBD" — toda decisão de escopo (autor, interação, remarcação, confirmação) já está resolvida acima com a razão da escolha.
