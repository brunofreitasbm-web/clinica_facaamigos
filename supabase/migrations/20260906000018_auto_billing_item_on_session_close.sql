-- supabase/migrations/20260906000018_auto_billing_item_on_session_close.sql
-- Faturamento por sessão (em vez de só por lote mensal): hoje uma
-- appointment só vira `billing_items` quando alguém abre
-- /faturamento/competencias e clica em "fechar competência"
-- (app/faturamento/competencias/actions.ts::closeCompetence, que reusa
-- computeCompetenceEligibility em lib/billing-eligibility.ts). Se ninguém
-- lembrar de fechar a competência daquele convênio+mês, a sessão realizada
-- fica de fora até alguém notar. Esta migration replica a MESMA regra de
-- elegibilidade (critérios 1,3,5,6 de computeCompetenceEligibility — o
-- critério 2 "dentro do mês" não se aplica aqui porque calculamos a
-- competência a partir da própria sessão, não filtramos por um mês já
-- escolhido) no momento em que a sessão individual fecha como 'realizada',
-- criando a linha de faturamento cedo. `closeCompetence` continua existindo
-- e continua idempotente (só insere o que faltar) — ela é o "catch-up" pra
-- sessão cuja evolução (session_notes) só foi assinada depois do check-out,
-- caso em que este trigger não insere nada (ver abaixo).
--
-- Modelo de estilo seguido: 20260906000016_auto_attendance_resolution.sql
-- (auto_resolve_appointments) — security definer, não deixa uma exceção
-- interromper o fluxo principal (aqui, o check-out em si).

-- Índice único: garante que nunca existam duas linhas de billing_items pra
-- uma mesma appointment, seja pelo botão manual (closeCompetence já checa
-- appointment_id em memória antes de inserir, mas duas chamadas concorrentes
-- podiam colidir) seja por este trigger rodando em paralelo com o fechamento
-- manual. `on conflict do nothing` no INSERT do trigger (mais abaixo) e no
-- INSERT de closeCompetence dependem deste índice.
create unique index if not exists billing_items_appointment_id_uniq
  on billing_items (appointment_id);

-- security definer: appointments_write/update roda como recepção/terapeuta
-- (roles sem INSERT em billing_periods/billing_items — billing_items_write
-- e billing_periods_write exigem role 'faturamento'/'gestor'), então a
-- função precisa dos privilégios do dono pra gravar o item de faturamento
-- no mesmo UPDATE que fecha a sessão, sem RLS barrando (mesmo padrão de
-- auto_resolve_appointments e refresh_reassessment_alerts).
create function bill_item_on_session_realizada() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  auth_row authorizations%rowtype;
  pi_row patient_insurance%rowtype;
  price_row insurer_price_tables%rowtype;
  session_date date;
  competence date;
  period_id uuid;
begin
  -- Só age na TRANSIÇÃO pra 'realizada' (mesmo cuidado de
  -- appointments_authorization_guard: um UPDATE que não muda o status, ex.
  -- editar checkout_at numa sessão já realizada, não deve gerar segunda
  -- tentativa) e só pra sessão "de verdade" — provisória (avaliação, ou
  -- marcada como provisional por outro motivo) não fatura, nem sessão sem
  -- guia vinculada.
  if new.status <> 'realizada'
     or new.is_provisional
     or new.is_evaluation
     or new.authorization_id is null
     or (TG_OP = 'UPDATE' and old.status = 'realizada')
  then
    return new;
  end if;

  -- Critério 4 de computeCompetenceEligibility (evolução assinada), mesma
  -- checagem que a RPC session_note_pending faz. No check-out a
  -- session_notes normalmente AINDA NÃO existe (é escrita depois, num
  -- fluxo separado) — aqui isso não é erro, só significa "ainda não dá pra
  -- faturar esta sessão"; o fechamento mensal manual pega assim que a nota
  -- for assinada. Checar aqui (em vez de deixar o trigger
  -- trg_billing_items_requires_session_note de billing_items rejeitar o
  -- INSERT) evita que a ausência de nota vire exceção dentro da própria
  -- transação de check-out.
  if not exists (select 1 from session_notes sn where sn.appointment_id = new.id) then
    return new;
  end if;

  select * into auth_row from authorizations where id = new.authorization_id;
  if not found then
    return new;
  end if;

  -- Critério 3: paciente precisa estar vinculado a este convênio via
  -- patient_insurance com is_private=false (mesmo filtro de
  -- computeCompetenceEligibility). Autorização normalmente já implica
  -- convênio, mas o filtro replica a regra de negócio à risca.
  select * into pi_row
  from patient_insurance
  where id = auth_row.patient_insurance_id and is_private = false;
  if not found then
    return new;
  end if;

  -- Data civil da sessão no fuso da clínica (America/Sao_Paulo), mesmo
  -- cálculo de civilDateInTimeZone em lib/timezone.ts — usado tanto pra
  -- achar o preço vigente quanto pra decidir a competência (mês) do item.
  session_date := (new.starts_at at time zone 'America/Sao_Paulo')::date;

  -- Critério 6: preço vigente em insurer_price_tables pro par
  -- (insurer_id, procedure_code) na data da sessão — mesma janela
  -- valid_from/valid_to de computeCompetenceEligibility.
  select * into price_row
  from insurer_price_tables
  where insurer_id = pi_row.insurer_id
    and procedure_code = auth_row.procedure_code
    and valid_from <= session_date
    and (valid_to is null or valid_to >= session_date)
  limit 1;

  if not found then
    -- Sem preço cadastrado pro procedimento: mesmo caso que
    -- computeCompetenceEligibility classifica como "inconsistente" (fica de
    -- fora, sem travar nada). Aqui simplesmente não insere — não inventa
    -- valor, não trava o check-out. Fica visível do jeito que já é hoje:
    -- some da lista até alguém cadastrar o preço e reprocessar (fechamento
    -- manual, ou o próprio fechamento re-lendo o item que faltou).
    return new;
  end if;

  competence := date_trunc('month', session_date)::date;

  -- billing_periods idempotente por (insurer_id, competence_month) — mesma
  -- lógica de closeCompetence (busca, senão cria), só que via
  -- on conflict em vez de select-then-insert porque aqui não há round-trip
  -- de aplicação pra tratar a corrida manualmente.
  insert into billing_periods (insurer_id, competence_month)
  values (pi_row.insurer_id, competence)
  on conflict (insurer_id, competence_month) do nothing;

  select id into period_id
  from billing_periods
  where insurer_id = pi_row.insurer_id and competence_month = competence;

  -- on conflict (appointment_id) do nothing: nunca duplica item pra mesma
  -- sessão, seja porque o fechamento manual já rodou pra ela, seja porque
  -- esta função rodou mais de uma vez (não deveria, dada a guarda de
  -- transição acima, mas o índice único é a garantia de verdade).
  insert into billing_items (billing_period_id, appointment_id, procedure_code, amount)
  values (period_id, new.id, auth_row.procedure_code, price_row.price)
  on conflict (appointment_id) do nothing;

  return new;
exception when others then
  -- Nunca deixa uma falha aqui (ex.: trg_billing_items_requires_session_note
  -- rejeitando por alguma corrida, ou qualquer outra) derrubar o check-out
  -- da sessão — mesmo espírito de robustez do bloco 1 de
  -- auto_resolve_appointments (uma linha problemática não trava as demais,
  -- aqui "as demais" é o próprio fluxo de check-out).
  raise warning 'bill_item_on_session_realizada: falha ao gerar billing_item para appointment %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke execute on function bill_item_on_session_realizada() from public, anon, authenticated;

create trigger trg_bill_item_on_session_realizada
  after insert or update on appointments
  for each row execute function bill_item_on_session_realizada();
