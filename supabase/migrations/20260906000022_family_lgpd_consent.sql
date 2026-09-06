-- supabase/migrations/20260906000022_family_lgpd_consent.sql
-- PRD §3.9: termo de consentimento LGPD exibido no portal antes de qualquer
-- interação (se ainda não assinado no cadastro) + opção de revogar
-- consentimento de imagem/comunicação, que deve bloquear o envio de
-- fotos/vídeos pelo terapeuta (mural, feed_media, 20260904000022).
--
-- Colunas em `guardians` (não uma tabela nova): consentimento é por
-- responsável, mesma linha que já guarda telefone/cpf/portal_enabled — não
-- há necessidade de histórico de versões de termo nesta entrega.
alter table guardians add column lgpd_consent_at timestamptz;
alter table guardians add column image_consent boolean not null default true;
alter table guardians add column image_consent_updated_at timestamptz;

-- Aceite/consentimento de imagem são operações que só o próprio responsável
-- pode fazer sobre a própria linha — em vez de abrir uma policy de UPDATE em
-- `guardians` (que exigiria decidir quais colunas ele pode tocar, já que RLS
-- não restringe por coluna), duas funções security definer, cada uma
-- tocando só o campo que deve.
create function accept_family_lgpd_consent() returns void
language plpgsql security definer set search_path = public as $$
begin
  update guardians set lgpd_consent_at = now() where profile_id = auth.uid();
end;
$$;
revoke all on function accept_family_lgpd_consent() from public;
grant execute on function accept_family_lgpd_consent() to authenticated;

create function set_family_image_consent(p_consent boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update guardians set image_consent = p_consent, image_consent_updated_at = now() where profile_id = auth.uid();
end;
$$;
revoke all on function set_family_image_consent(boolean) from public;
grant execute on function set_family_image_consent(boolean) to authenticated;

-- Bloqueio de fato: nenhum novo anexo de foto/vídeo pode entrar no mural de
-- um paciente cujo responsável revogou o consentimento de imagem — trigger
-- no insert de feed_media (não em feed_posts, que pode ter só texto) garante
-- isso mesmo se algum cliente pular a validação de UI do terapeuta.
create function trg_feed_media_check_image_consent() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_patient_id uuid;
  v_revoked boolean;
begin
  select fp.patient_id into v_patient_id from feed_posts fp where fp.id = new.post_id;

  select exists(
    select 1 from guardians g where g.patient_id = v_patient_id and g.image_consent = false
  ) into v_revoked;

  if v_revoked then
    raise exception 'A família revogou o consentimento de uso de imagem para este paciente — não é possível anexar fotos/vídeos ao mural.';
  end if;

  return new;
end;
$$;

create trigger trg_feed_media_image_consent before insert on feed_media
  for each row execute function trg_feed_media_check_image_consent();
