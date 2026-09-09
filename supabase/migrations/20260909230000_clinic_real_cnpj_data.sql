-- Preenche os dados institucionais reais da clínica (CNPJ emitido pela
-- Receita Federal em 30/03/2015, comprovante consultado em 09/09/2026) na
-- linha única da tabela `clinics` (ver DEV_CLINIC_ID em lib/constants.ts).
-- Alimenta o timbre dos PDFs e documentos impressos via getClinicIdentity
-- (lib/clinic-identity.ts) — nome fantasia (`name`) permanece "FaçaAmigos",
-- só a razão social e os dados de registro mudam.

update public.clinics
set
  razao_social = 'INSTITUTO FACA AMIGOS LTDA',
  cnpj = '22.161.197/0001-83',
  endereco_logradouro = 'R Boaventura da Silva',
  endereco_numero = '1573',
  endereco_bairro = 'Umarizal',
  endereco_cidade = 'Belém',
  endereco_uf = 'PA',
  endereco_cep = '66060-147',
  telefone = '(91) 8250-1215'
where id = 'c0000000-0000-0000-0000-000000000001';
