-- Assinatura de quem emite os documentos da recepção (app/recepcao/documentos).
-- A imagem fica no bucket privado clinic-documents (nunca no repositório, que é
-- público); aqui só o caminho. Cada pessoa envia e remove a PRÓPRIA assinatura
-- (server action com o id da sessão), e ela só sai nos documentos que essa
-- pessoa emite.
alter table profiles add column if not exists signature_path text;

comment on column profiles.signature_path is
  'Caminho da assinatura (PNG sem fundo) no bucket clinic-documents. Ver app/recepcao/documentos/signature-actions.ts.';
