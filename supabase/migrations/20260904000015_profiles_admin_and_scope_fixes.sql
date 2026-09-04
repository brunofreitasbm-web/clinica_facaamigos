-- supabase/migrations/20260904000015_profiles_admin_and_scope_fixes.sql
-- Fix round 3 (re-review do fix wave anterior 20260904000014): N1-N3.
-- Não edita nenhuma migration já commitada — apenas create/drop policy e
-- create or replace function, seguindo o padrão já usado em 20260904000014.

-- =====================================================================
-- N1 — profiles ficou sem NENHUMA policy de UPDATE administrativa: o fix
-- C1 (20260904000014) trancou profiles_self_update com WITH CHECK que
-- impede o próprio usuário de mudar role/clinic_id/esdm_certified/active.
-- Como essa era a ÚNICA policy de UPDATE em profiles, ninguém (nem gestor)
-- consegue mais certificar terapeuta em ESDM, desativar perfil, ou mudar
-- papel de alguém.
--
-- Fix: policy adicional profiles_admin_update permitindo gestor da MESMA
-- clínica atualizar qualquer perfil da própria clínica (incluindo
-- role/active/esdm_certified), com WITH CHECK garantindo que clinic_id
-- não muda no update (gestor não pode "roubar" perfil pra outra clínica).
--
-- Análise de escalação — ATENÇÃO a uma pegadinha real do Postgres RLS: com
-- múltiplas policies permissivas para o mesmo comando (UPDATE), o USING
-- final é a OR de todos os USING aplicáveis, e o WITH CHECK final é a OR de
-- TODOS os WITH CHECK aplicáveis — não apenas o da policy cujo USING deu
-- match na linha. Isso foi verificado experimentalmente: uma primeira versão
-- desta policy usava "with check (clinic_id = current_clinic_id())" (sem
-- repetir app_current_role() = 'gestor'), e um TERAPEUTA COMUM conseguiu
-- alterar o PRÓPRIO role para 'gestor' — porque seu update casava no USING
-- de profiles_self_update (id = auth.uid()), e depois o WITH CHECK efetivo
-- era (profiles_self_update.check OR profiles_admin_update.check); o
-- primeiro bloqueava a mudança de role, mas o segundo (só checando
-- clinic_id, que não muda) passava, e OR com um `true` libera o update.
-- Fix real: profiles_admin_update repete app_current_role() = 'gestor' no
-- WITH CHECK também (não só no USING). Com isso:
--   - Usuário comum: nem USING nem WITH CHECK de profiles_admin_update
--     jamais passam (app_current_role() dele nunca é 'gestor') — a única
--     rota de update continua profiles_self_update, que trava role/
--     clinic_id/esdm_certified/active. Confirmado pelo teste N1c.
--   - Gestor alterando outro perfil da própria clínica: USING e WITH CHECK
--     de profiles_admin_update passam normalmente — esse é o caso de uso
--     pretendido (certificar ESDM, desativar, mudar role de terceiros).
--   - Gestor alterando o PRÓPRIO perfil: tecnicamente ainda pode usar
--     profiles_admin_update (ele é gestor da própria clínica), mas isso é
--     inofensivo — 'gestor' já é o papel mais alto do sistema (não há para
--     onde escalar), e ele continua impedido de mudar o próprio clinic_id
--     (WITH CHECK exige clinic_id = current_clinic_id()). Não há
--     escalação de privilégio real nesse caso, só um gestor podendo
--     reconfigurar a si mesmo — o que outro gestor da mesma clínica já
--     poderia fazer de qualquer forma.
-- =====================================================================
-- IMPORTANTE: o WITH CHECK precisa repetir app_current_role() = 'gestor', não só
-- clinic_id = current_clinic_id(). Postgres combina com OR o WITH CHECK de TODAS
-- as policies permissivas aplicáveis ao comando — não apenas a policy cujo USING
-- deu match. Sem repetir a condição de papel aqui, um terapeuta comum (que casa
-- no USING de profiles_self_update) teria sua linha aceita por ESTE WITH CHECK
-- (que só olha clinic_id, sempre verdadeiro pois ele não está mudando de clínica)
-- e conseguiria alterar o próprio role — reabrindo exatamente a escalação que o
-- WITH CHECK de profiles_self_update foi desenhado para impedir. Confirmado via
-- teste funcional (supabase/tests/015_profiles_admin_test.sql, caso N1c).
create policy profiles_admin_update on profiles for update
  using (clinic_id = current_clinic_id() and app_current_role() = 'gestor')
  with check (clinic_id = current_clinic_id() and app_current_role() = 'gestor');

-- =====================================================================
-- N2 — therapist_contracts_manage_by_gestor_upd (fix I1 em 20260904000014)
-- ganhou USING escopado por clínica, mas ficou sem WITH CHECK: um gestor
-- podia UPDATE reapontando profile_id do contrato para um profile de OUTRA
-- clínica, escapando do escopo original.
-- =====================================================================
drop policy therapist_contracts_manage_by_gestor_upd on therapist_contracts;

create policy therapist_contracts_manage_by_gestor_upd on therapist_contracts for update
  using (
    app_current_role() = 'gestor'
    and exists (select 1 from profiles p where p.id = therapist_contracts.profile_id and p.clinic_id = current_clinic_id())
  )
  with check (
    app_current_role() = 'gestor'
    and exists (select 1 from profiles p where p.id = therapist_contracts.profile_id and p.clinic_id = current_clinic_id())
  );

-- =====================================================================
-- N3 — session_note_pending() (fix M3 em 20260904000014, agora SECURITY
-- DEFINER) não checa clinic_id internamente: qualquer autenticado, dado um
-- appointment_id de OUTRA clínica, consegue descobrir se existe nota
-- pendente lá (vazamento cross-clínica via SECURITY DEFINER).
--
-- Fix: guard de clinic_id nas duas subqueries, garantindo que a função só
-- enxerga o appointment se ele pertencer à clínica do chamador. Para
-- appointment de outra clínica (ou inexistente), retorna false — não
-- lança erro, para não distinguir "existe em outra clínica" de "não
-- existe" via mensagem de exceção.
-- =====================================================================
create or replace function session_note_pending(p_appointment_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from appointments a
    join patients pt on pt.id = a.patient_id
    where a.id = p_appointment_id
      and a.status = 'realizada'
      and pt.clinic_id = current_clinic_id()
  )
  and not exists (
    select 1 from session_notes sn
    join appointments a on a.id = sn.appointment_id
    join patients pt on pt.id = a.patient_id
    where sn.appointment_id = p_appointment_id
      and pt.clinic_id = current_clinic_id()
  );
$$;
