-- Autorizações de convênio: muitos planos emitem uma senha de autorização
-- separada do número da guia, com sua própria validade (nem todos —
-- password_valid_until fica nullable). Nada gravava isso até agora; o
-- formulário de stage 3 (app/recepcao/pacientes/[id]/page.tsx) passa a
-- capturar os dois campos e stage-actions.ts::registerAuthorization grava
-- aqui.
alter table authorizations
  add column authorization_password text,
  add column password_valid_until date;
