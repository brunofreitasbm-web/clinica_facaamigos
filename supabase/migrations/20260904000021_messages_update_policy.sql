-- supabase/migrations/20260904000021_messages_update_policy.sql
-- `messages` (20260904000012) só tinha policies de SELECT e INSERT — RLS
-- habilitada sem nenhuma policy de UPDATE bloqueia qualquer UPDATE (0 linhas
-- afetadas, sem erro). A aba "Caixa de entrada" do painel de supervisão
-- (app/supervisao/inbox-actions.ts) precisa marcar um chamado da família
-- como lido/resolvido (`read_at`) — mesma tabela, mesmo escopo de clínica e
-- papéis já usados em `messages_write` (20260904000014), restrito à
-- coordenação/recepção/gestão porque só elas "resolvem" um chamado por essa
-- tela (o portal da família, fora do escopo desta implementação, é quem no
-- futuro atualizaria `read_at` do lado do responsável).
create policy messages_update_staff on messages for update
  using (
    exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('recepcao', 'supervisor', 'gestor')
  )
  with check (
    exists (select 1 from patients pt where pt.id = messages.patient_id and pt.clinic_id = current_clinic_id())
    and app_current_role() in ('recepcao', 'supervisor', 'gestor')
  );
