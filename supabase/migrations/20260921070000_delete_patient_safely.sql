-- Excluir paciente (botão "Excluir" da lista de pacientes) de verdade.
--
-- Por que o botão "não apagava": `patients` não tem policy de DELETE. Com RLS, o
-- delete da Server Action (client de sessão) afetava 0 linhas SEM erro — a
-- action respondia "sucesso", o modal fechava e o paciente continuava lá. E,
-- mesmo com permissão, ~40 tabelas referenciam patients (a maioria NO ACTION):
-- o cadastro de qualquer lead já tem responsável, intake_steps, documentos etc.
-- e o delete direto falharia na FK.
--
-- delete_patient_safely(p_patient_id) faz tudo numa transação só:
--   * só gestor da clínica do paciente (mesmo critério da Server Action);
--   * NÃO exclui quem tem histórico assistencial/financeiro (consultas, plano
--     terapêutico, anamnese, avaliações, cobranças, recibos, contratos, alta,
--     sessões, pesquisas...) — devolve o motivo e a saída correta é Inativar;
--   * cadastro sem histórico (lead, pré-cadastro, duplicata): remove o que é só
--     do cadastro (responsáveis, documentos, etapas de acolhimento, convênios,
--     tags, rascunhos de cadastro, trilha de acesso ao prontuário) e SOLTA o que
--     é histórico de comunicação (a conversa de WhatsApp continua em Atendimento
--     como conversa de lead; solicitações do bot e leads de convênio ficam sem
--     paciente);
--   * devolve os caminhos dos arquivos no Storage — o banco não apaga objeto do
--     bucket; a Server Action remove depois que a transação confirmou.
-- A trilha do delete em si fica no audit_log (trigger trg_audit_patients).

create or replace function delete_patient_safely(p_patient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_has boolean;
  v_reasons text[] := '{}';
  v_paths text[];
  v_item record;
begin
  if auth.uid() is null or app_current_role() is distinct from 'gestor' then
    return jsonb_build_object('success', false, 'error', 'Apenas gestores podem excluir o cadastro de um paciente.');
  end if;

  select clinic_id into v_clinic from patients where id = p_patient_id;
  if not found or v_clinic is distinct from current_clinic_id() then
    return jsonb_build_object('success', false, 'error', 'Paciente não encontrado.');
  end if;

  -- Histórico assistencial/financeiro: quem tem isto é paciente de verdade e
  -- não se apaga (Inativar preserva prontuário, faturamento e trilha).
  for v_item in
    select * from (values
      ('appointments', 'consultas/agendamentos'),
      ('treatment_plans', 'plano terapêutico'),
      ('anamneses', 'anamnese'),
      ('protocol_assessments', 'avaliações de protocolo'),
      ('fono_assessments', 'avaliações de fonoaudiologia'),
      ('socially_savvy_assessments', 'avaliações socioemocionais'),
      ('patient_charges', 'cobranças'),
      ('receipts', 'recibos'),
      ('billing_disallowances', 'glosas'),
      ('patient_contracts', 'contratos'),
      ('bonding_reports', 'relatórios de vínculo'),
      ('draft_reports', 'relatórios'),
      ('meetings', 'reuniões'),
      ('patient_discharge_events', 'alta'),
      ('session_note_media', 'mídias de evolução'),
      ('session_intervention_logs', 'registros de intervenção'),
      ('aba_abc_logs', 'registros ABA'),
      ('at_sessions', 'sessões de AT'),
      ('survey_responses', 'respostas de pesquisa'),
      ('family_feedback', 'devolutivas da família'),
      ('feed_posts', 'publicações no mural da família'),
      ('voice_emergency_logs', 'registros de emergência')
    ) as t(tbl, label)
  loop
    execute format('select exists (select 1 from %I where patient_id = $1)', v_item.tbl) into v_has using p_patient_id;
    if v_has then v_reasons := v_reasons || v_item.label; end if;
  end loop;

  if array_length(v_reasons, 1) > 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Este paciente tem histórico (' || array_to_string(v_reasons, ', ') ||
        ') e não pode ser excluído. Use "Inativar" para preservar o prontuário e o faturamento.'
    );
  end if;

  -- Arquivos que ficam órfãos no Storage: documentos do paciente e arquivos de
  -- rascunho que não apontam para um documento (esses têm caminho próprio).
  select coalesce(array_agg(distinct path), '{}') into v_paths from (
    select storage_path as path from documents where patient_id = p_patient_id and storage_path is not null
    union
    select f.storage_path from registration_draft_files f
      join registration_drafts d on d.id = f.draft_id
     where d.patient_id = p_patient_id and f.document_id is null and f.storage_path is not null
  ) s;

  -- Rascunhos de cadastro do paciente saem da fila de Pendências (os arquivos
  -- dos rascunhos saem junto, em cascata).
  delete from registration_drafts where patient_id = p_patient_id;

  -- Comunicação: o histórico continua, sem apontar para o paciente/responsável.
  update anamnesis_scheduling_requests set patient_id = null where patient_id = p_patient_id;
  update checkin_requests set patient_id = null where patient_id = p_patient_id;
  update insurance_intake_leads set patient_id = null where patient_id = p_patient_id;
  update insurance_intake_leads set duplicate_patient_id = null where duplicate_patient_id = p_patient_id;
  update insurance_intake_leads set guardian_id = null
   where guardian_id in (select id from guardians where patient_id = p_patient_id);
  update insurance_intake_lead_files set document_id = null
   where document_id in (select id from documents where patient_id = p_patient_id);
  update external_contact_logs set document_id = null
   where document_id in (select id from documents where patient_id = p_patient_id);
  -- Arquivos de rascunho (de qualquer rascunho, mesmo de outro telefone/cadastro)
  -- que apontam para documentos deste paciente: o documento vai embora, a linha
  -- que o referencia também.
  delete from registration_draft_files
   where document_id in (select id from documents where patient_id = p_patient_id);

  -- A conversa de WhatsApp vira conversa de lead (kind 'lead' exige clinic_id);
  -- mensagens sem conversa não têm dono sem o paciente, então saem.
  update twilio_conversations
     set clinic_id = coalesce(clinic_id, v_clinic), kind = 'lead', patient_id = null, guardian_id = null
   where patient_id = p_patient_id;
  update messages set patient_id = null, guardian_id = null
   where patient_id = p_patient_id and conversation_id is not null;
  delete from messages where patient_id = p_patient_id;
  update messages set guardian_id = null
   where guardian_id in (select id from guardians where patient_id = p_patient_id);
  update twilio_conversations set guardian_id = null
   where guardian_id in (select id from guardians where patient_id = p_patient_id);
  -- Rascunhos de outros cadastros/telefones que citam o responsável.
  update registration_drafts set guardian_id = null
   where guardian_id in (select id from guardians where patient_id = p_patient_id);

  -- Só do cadastro.
  delete from pending_queue_assignments where patient_id = p_patient_id;
  delete from record_access_log where patient_id = p_patient_id;
  delete from patient_tags where patient_id = p_patient_id;
  delete from patient_access where patient_id = p_patient_id;
  delete from patient_insurance where patient_id = p_patient_id;
  delete from intake_steps where patient_id = p_patient_id;
  delete from acolhimento_requests where patient_id = p_patient_id;
  delete from anamnesis_prefill_requests where patient_id = p_patient_id;
  delete from absence_alerts where patient_id = p_patient_id;
  delete from reassessment_alerts where patient_id = p_patient_id;
  delete from nps_surveys where patient_id = p_patient_id;
  delete from documents where patient_id = p_patient_id;
  delete from guardians where patient_id = p_patient_id;

  delete from patients where id = p_patient_id;

  return jsonb_build_object('success', true, 'storage_paths', to_jsonb(v_paths));
exception
  when foreign_key_violation then
    -- Alguma tabela nova aponta para patients e não foi tratada acima: nada é
    -- apagado (o bloco desfaz tudo) e a recepção recebe uma orientação clara.
    return jsonb_build_object(
      'success', false,
      'error', 'Este paciente ainda tem registros vinculados e não pode ser excluído. Use "Inativar" para preservar o histórico.'
    );
end;
$$;

revoke all on function delete_patient_safely(uuid) from public, anon;
grant execute on function delete_patient_safely(uuid) to authenticated;
