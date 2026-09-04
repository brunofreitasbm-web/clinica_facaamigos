-- supabase/migrations/20260904000024_group_session_overlap.sql
-- Item 11 do PRD "11 incrementos" (repasse): decisão confirmada com o
-- usuário — "PJ remunerado por sessão, podendo ser mais de uma sessão por
-- horário", restrito a sessões em grupo. Uma sessão de grupo (PRD §6/§11)
-- é modelada como várias linhas de `appointments` (1 por paciente do
-- grupo) compartilhando terapeuta, sala e horário — hoje os dois EXCLUDE
-- constraints de 20260904000006_appointments.sql bloqueiam exatamente essa
-- sobreposição, tanto por sala quanto por terapeuta. Sessões individuais
-- continuam 100% exclusivas; só `modality = 'grupo'` fica de fora das duas
-- exclusões. O repasse por sessão (cada linha gera seu próprio
-- payout_items) é responsabilidade de outra frente de trabalho — esta
-- migration só destrava o schema pra isso ser possível.
alter table appointments drop constraint appointments_room_id_tstzrange_excl;
alter table appointments add constraint appointments_room_id_tstzrange_excl
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (
    status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
    and modality <> 'grupo'
  );

alter table appointments drop constraint appointments_therapist_id_tstzrange_excl;
alter table appointments add constraint appointments_therapist_id_tstzrange_excl
  exclude using gist (
    therapist_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (
    status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
    and modality <> 'grupo'
  );

-- Os EXCLUDE acima deixam `modality='grupo'` inteiramente FORA do índice de
-- exclusão (não é comparado contra nada, nem contra outras linhas de
-- grupo, nem contra individuais) — é assim que se permite várias linhas de
-- grupo sobrepostas entre si. Mas isso abre uma lacuna: uma sessão
-- INDIVIDUAL nova não seria barrada de ocupar terapeuta/sala já tomados por
-- uma sessão em GRUPO no mesmo horário (e vice-versa), porque uma das duas
-- linhas nunca entra no índice. Este trigger fecha essa lacuna
-- especificamente para o caso misto grupo×individual; grupo×grupo continua
-- livre (é o objetivo da mudança) e individual×individual continua coberto
-- pelos EXCLUDE de sempre.
create function appointments_group_overlap_guard() returns trigger
language plpgsql as $$
begin
  if new.status in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada') then
    return new;
  end if;
  if exists (
    select 1 from appointments a
    where a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and a.status not in ('cancelada_familia','cancelada_terapeuta','cancelada_clinica','remarcada')
      and (a.modality = 'grupo') <> (new.modality = 'grupo')
      and (a.therapist_id = new.therapist_id or a.room_id = new.room_id)
      and tstzrange(a.starts_at, a.ends_at) && tstzrange(new.starts_at, new.ends_at)
  ) then
    raise exception 'sessão individual e sessão em grupo não podem compartilhar terapeuta/sala no mesmo horário';
  end if;
  return new;
end;
$$;

create trigger trg_appointments_group_overlap_guard
  before insert or update on appointments
  for each row execute function appointments_group_overlap_guard();
