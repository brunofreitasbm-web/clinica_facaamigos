-- Identidade institucional da clínica: alimenta o timbre (papel timbrado) de
-- todo documento impresso ou exportado em PDF — relatório de convênio,
-- compartilhamento com a família, calendário do PTS, laudos de instrumento.
--
-- Tudo nullable de propósito: o timbre renderiza SÓ o que estiver preenchido
-- (ver lib/clinic-identity.ts). Documento fiscal/clínico não pode sair com
-- endereço ou CNPJ inventado, então campo vazio simplesmente não aparece.
--
-- Não cria policy: `clinics` já tem RLS com `clinics_read`, que vale para as
-- colunas novas.

alter table public.clinics
  add column if not exists razao_social text,
  add column if not exists endereco_logradouro text,
  add column if not exists endereco_numero text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_uf text,
  add column if not exists endereco_cep text,
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists site text,
  -- Responsável técnico e registro no conselho: exigido no rodapé de
  -- documento clínico que sai da clínica (ex.: "Fulana de Tal · CRP 06/12345").
  add column if not exists responsavel_tecnico text,
  add column if not exists responsavel_tecnico_conselho text;

comment on column public.clinics.razao_social is
  'Razão social completa. Quando vazia, o timbre usa `name` (nome fantasia).';
comment on column public.clinics.responsavel_tecnico_conselho is
  'Registro do responsável técnico como sai impresso, ex.: "CRP 06/12345".';

alter table public.clinics
  add constraint clinics_endereco_uf_check
  check (endereco_uf is null or endereco_uf ~ '^[A-Z]{2}$');
