-- Oculta perfis genéricos (Estagiário/CLT/PJ por unidade) das listas deste sistema,
-- sem inativar: `active` e o banimento no Auth afetam o login em outros sistemas.
alter table public.profiles
  add column if not exists hidden_in_app boolean not null default false;

comment on column public.profiles.hidden_in_app is
  'true = não aparece em listas/seletores do app da clínica. Não altera login nem active.';

update public.profiles
   set hidden_in_app = true
 where id in (
  '2a03ff16-d3ce-4544-8fbf-eb7f4827de66','b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23','bf259785-7382-449d-b8d1-7393beba59db',
  'd40eed38-686f-4208-bd4d-2efdff3cb128','dc58f612-77ec-47d9-92dc-aa4d711cc332',
  '653119dd-81c3-4bf5-9893-1945a4a16ba5','f997d492-fc65-48a0-83d4-9cc243804a3c',
  '281ae6ad-cb5d-4e6d-ba20-7c90b01a241d','80d9d525-cffe-4366-8b77-08522f9c30b1',
  '6a7b622b-5e8f-4f0f-afc6-634aeb0b2b79','0ce58741-6867-4b7e-9fea-496003dbfc87'
 );
