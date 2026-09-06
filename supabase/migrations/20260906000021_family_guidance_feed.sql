-- supabase/migrations/20260906000021_family_guidance_feed.sql
-- PRD §3.5/§9.7: "Exibir as orientações registradas pelo terapeuta no campo
-- 'Orientação dada à família' — único dado clínico-visível." session_notes
-- já grava isso em `structured.orientacoes` (chips fixos de
-- lib/session-note-fields.ts: rotina/comunicação/alimentação/sono/escola),
-- só que session_notes_read (20260904000007) não dá nenhuma policy pro papel
-- 'responsavel' — e não deveria: a família nunca pode ver free_text,
-- presença/comportamentos ou o texto bruto da evolução (PRD "nunca vê
-- evolução clínica bruta").
--
-- Em vez de abrir uma policy de SELECT (RLS é por LINHA, não por coluna —
-- um responsável com policy de SELECT em session_notes poderia consultar
-- free_text diretamente via PostgREST, mesmo que a UI só mostre
-- orientacoes), a única forma segura de expor só esse campo é uma função
-- security definer que devolve apenas os dados já traduzidos pro portal.
create function family_guidance_feed(p_patient_id uuid, p_limit int default 5)
returns table (appointment_id uuid, starts_at timestamptz, orientacoes text[])
language plpgsql security definer set search_path = public as $$
begin
  if not has_patient_access(p_patient_id, array['responsavel']) then
    raise exception 'access denied';
  end if;

  return query
    select a.id, a.starts_at, array(select jsonb_array_elements_text(sn.structured->'orientacoes'))
    from session_notes sn
    join appointments a on a.id = sn.appointment_id
    where a.patient_id = p_patient_id
      and sn.signed_at is not null
      -- só a versão mais recente de cada sessão (maior `version` por
      -- appointment_id) — evita mostrar a mesma sessão duas vezes quando
      -- ela foi corrigida (session_notes_versioning, 20260906060816).
      and sn.version = (
        select max(sn2.version) from session_notes sn2 where sn2.appointment_id = sn.appointment_id
      )
      and jsonb_array_length(coalesce(sn.structured->'orientacoes', '[]'::jsonb)) > 0
    order by a.starts_at desc
    limit p_limit;
end;
$$;

revoke all on function family_guidance_feed(uuid, int) from public;
grant execute on function family_guidance_feed(uuid, int) to authenticated;
