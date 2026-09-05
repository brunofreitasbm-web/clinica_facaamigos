-- supabase/migrations/20260904000031_survey_responses_hardening.sql
--
-- §9.7 do PRD: "Questionário trimestral (NPS + perguntas sobre recepção e
-- terapeuta)" nunca teve UI nem endurecimento de dados — corrigido junto
-- com a implementação do formulário no portal da família.
--
-- 1) survey_responses_write (20260904000011_metrics.sql) só confere que o
-- guardian_id pertence a quem está logado, mas nunca confere que esse
-- guardian é responsável pelo patient_id enviado — um responsável logado
-- podia gravar uma resposta de NPS pra QUALQUER paciente (poluindo a
-- métrica family_nps, §10.3, de outro terapeuta). Aperta o with check.
drop policy survey_responses_write on survey_responses;
create policy survey_responses_write on survey_responses for insert
  with check (
    exists (
      select 1 from guardians g
      where g.id = survey_responses.guardian_id
        and g.profile_id = auth.uid()
        and g.patient_id = survey_responses.patient_id
    )
  );

-- 2) Sem isso, o mesmo responsável podia responder a pesquisa do mesmo
-- trimestre várias vezes (double-submit por duplo clique, ou reenvio
-- deliberado) — a aplicação já evita mostrar o formulário de novo, mas o
-- banco é o portão real.
alter table survey_responses
  add constraint survey_responses_unique_period unique (patient_id, guardian_id, period);
