-- supabase/migrations/20260906000020_session_notes_versioning.sql
-- Fecha a lacuna de rastreabilidade do PRD §9.4/§9.4-A: hoje o schema já
-- suporta version/supersedes_id (20260904000007_session_notes.sql), mas
-- nada no banco garante que uma edição (version > 1) tenha justificativa
-- nem que encadeie corretamente na versão anterior. A aplicação nunca
-- deve ser a única linha de defesa para append-only + rastreabilidade.

alter table session_notes add column edit_justification text;

-- Toda versão > 1 exige justificativa não vazia; version 1 nunca tem.
alter table session_notes add constraint session_notes_edit_justification_required
  check (
    (version = 1 and supersedes_id is null and edit_justification is null)
    or (
      version > 1
      and supersedes_id is not null
      and edit_justification is not null
      and length(trim(edit_justification)) > 0
    )
  );

-- Garante que a cadeia de versões é honesta: supersedes_id sempre aponta
-- para a versão imediatamente anterior da MESMA sessão. Sem isso, a RLS
-- de insert (append-only) não impede que alguém insira uma "versão 3"
-- que pule a 2, ou aponte para outro appointment.
create or replace function validate_session_note_chain() returns trigger
language plpgsql as $$
begin
  if new.version = 1 then
    return new;
  end if;

  if not exists (
    select 1 from session_notes sn
    where sn.id = new.supersedes_id
      and sn.appointment_id = new.appointment_id
      and sn.version = new.version - 1
  ) then
    raise exception 'supersedes_id inválido: deve apontar para a versão % desta sessão', new.version - 1;
  end if;

  return new;
end;
$$;

create trigger session_notes_validate_chain
  before insert on session_notes
  for each row execute function validate_session_note_chain();
