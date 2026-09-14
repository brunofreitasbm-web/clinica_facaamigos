-- Dados clínicos adicionais na ficha do paciente: CID e nível de suporte já
-- existiam; medicação/alergia/comorbidade faltavam como campos próprios do
-- paciente (só viviam soltos em anamneses.structured). Alimentados pelo
-- supervisor na 1ª avaliação ou pela recepção quando já tem a informação —
-- mesma RLS de patients_update_recepcao_supervisor cobre os dois papéis.
alter table patients
  add column medication text,
  add column allergies text,
  add column comorbidities text;
