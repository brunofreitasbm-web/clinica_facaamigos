-- Os dois playgrounds já ficam cadastrados (só há 1 PDV em cada): quem agenda apenas
-- escolhe qual. O código da unidade é o id da unidade no PDV (fa_kiosk_units.id).
-- O Circuito não entra: a avaliação é só nos playgrounds.

-- Corrige o local que foi cadastrado à mão com o código "01" (não existe no PDV).
update playground_locations
set pos_unit_id = '11111111-1111-1111-1111-111111111111', name = 'Parque Shopping'
where pos_unit_id = '01'
  and not exists (
    select 1 from playground_locations x
    where x.clinic_id = playground_locations.clinic_id and x.pos_unit_id = '11111111-1111-1111-1111-111111111111'
  );

insert into playground_locations (clinic_id, name, pos_unit_id)
select c.id, v.name, v.unit
from clinics c
cross join (values
  ('Parque Shopping', '11111111-1111-1111-1111-111111111111'),
  ('Bosque Grão-Pará', '5fc99a57-81ee-4232-a105-1fcb4634cef4')
) as v(name, unit)
on conflict (clinic_id, pos_unit_id) do nothing;
