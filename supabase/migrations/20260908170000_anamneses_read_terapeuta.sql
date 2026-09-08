-- 1ª avaliação (anamnese ampliada) conduzida por terapeuta avaliador.
--
-- `anamneses_write` (20260906000001_intake_journey.sql) já liberava
-- 'terapeuta' para inserir, mas `anamneses_read` só liberava terapeuta com
-- vínculo explícito (`has_patient_access(..., 'terapeuta')`). O terapeuta
-- avaliador escalado no calendário de 1ª avaliação
-- (app/supervisao/evaluation-calendar.tsx) normalmente ainda NÃO tem esse
-- vínculo — ele é criado depois, na montagem da equipe — então ele salvava
-- a anamnese e em seguida não conseguia lê-la de volta (a tela voltava a
-- mostrar o formulário em branco, e um segundo salvamento era barrado pela
-- checagem de duplicidade).
--
-- Alinha a leitura ao que 20260907180001_open_patient_chart_for_substitute_therapist
-- já decidiu para o restante do prontuário (patients, treatment_plans,
-- plan_goals, programs, patient_insurance): qualquer terapeuta da clínica
-- lê. O estreitamento de QUEM conduz a 1ª avaliação fica na aplicação
-- (lib/anamnese-access.ts: avaliador ou terapeuta da avaliação agendada).
drop policy anamneses_read on anamneses;
create policy anamneses_read on anamneses for select
  using (
    exists (
      select 1 from patients pt
      where pt.id = anamneses.patient_id
        and pt.clinic_id = (select current_clinic_id())
    )
    and (
      (select app_current_role()) = any (array['gestor','supervisor','recepcao','terapeuta'])
      or (select has_patient_access(anamneses.patient_id, array['terapeuta']))
    )
  );
