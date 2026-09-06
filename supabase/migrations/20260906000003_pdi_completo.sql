-- supabase/migrations/20260906000003_pdi_completo.sql
-- Módulo 3 MAAIS, slides 27-34: um PDI de qualidade tem objetivo geral,
-- horizonte (curto/médio/longo), estratégia e metodologia por meta, e a
-- entrega/aceite da família é um evento registrado — não um "aconteceu, mas
-- ninguém sabe quando". Também resolve a nota deliberadamente descartada em
-- plan-actions.ts::returnAllPendingGoals (o schema não tinha onde gravar).

alter table plan_goals
  add column horizon text check (horizon in ('curto', 'medio', 'longo')),
  add column strategy text,
  add column methodology text check (methodology in ('dtt', 'naturalistico', 'misto', 'outra')),
  add column supervisor_notes text;

alter table treatment_plans
  add column general_objective text,
  add column supervisor_notes text,
  add column delivered_at timestamptz,
  add column delivered_by uuid references profiles(id),
  add column family_accepted_at timestamptz,
  add column previous_plan_id uuid references treatment_plans(id),
  add column family_priorities text;

-- Conclui as etapas do checklist de entrada ligadas ao PDI (slide 20, itens
-- 8-10: construção, revisão pela supervisão, devolutiva).
create function trg_treatment_plans_intake_sync() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  if tg_op = 'INSERT' then
    perform set_intake_step_complete(new.patient_id, 'pdi_construido');
  end if;
  if tg_op = 'UPDATE' then
    if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
      perform set_intake_step_complete(new.patient_id, 'pdi_validado');
    end if;
    if new.delivered_at is not null and old.delivered_at is null then
      perform set_intake_step_complete(new.patient_id, 'devolutiva_familia');
    end if;
  end if;
  return new;
end;
$f$;

create trigger treatment_plans_intake_sync
  after insert or update on treatment_plans
  for each row execute function trg_treatment_plans_intake_sync();
