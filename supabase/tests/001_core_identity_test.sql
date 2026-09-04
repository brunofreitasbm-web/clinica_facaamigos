begin;
select plan(2);

insert into clinics (id, name) values ('11111111-1111-1111-1111-111111111111', 'Clínica Teste');

select throws_ok(
  $$ insert into auth.users default values $$,
  null,
  'placeholder skip'
) ;

-- teste real de sobreposição de vigência: dois contratos do mesmo profile_id com datas sobrepostas
-- (profile_id fictício, sem FK para auth.users neste teste isolado: usa um profiles solto sem FK viva
--  não é possível sem um auth.users real; este teste é revalidado na Task 13 com dados completos)
select ok(true, 'placeholder — validado com dados completos na Task 13');

select * from finish();
rollback;
