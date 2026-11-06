-- Oculta das listas do app os perfis @portoterapia.com e @grupoib.internal.
-- Não altera `active`, Auth nem exclui: o outro sistema continua usando esses perfis.
update public.profiles
   set hidden_in_app = true
 where hidden_in_app = false
   and (email ilike '%@portoterapia.com' or email ilike '%@grupoib.internal');
