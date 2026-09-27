-- Decisão do usuário (27/09/2026, plano do módulo financeiro HUB): a conta
-- de CPF de Isabella (hoje 'terapeuta') passa a 'gestor' para abrir o novo
-- módulo /gestor/financeiro-hub — que, como todo o resto de /gestor, é
-- liberado por completo pra quem é 'gestor' (ver ROLE_ALLOWED_PREFIXES em
-- lib/roles.ts: gestor não tem prefixo restrito, acessa tudo).
--
-- Efeito colateral assumido e aceito pelo usuário: Isabella passa a ver e
-- operar todo o sistema como gestora, não só o financeiro. WHERE é
-- restrito a essa conta específica (full_name + role atual) pra não afetar
-- a conta de e-mail "Isabella" (supervisor, sem CPF) por engano.
update profiles
set role = 'gestor'
where full_name = 'Isabella Freitas'
  and cpf is not null
  and role = 'terapeuta';
