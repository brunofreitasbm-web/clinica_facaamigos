-- Libera edição dos dados institucionais da clínica (nome, CNPJ, endereço,
-- contato, responsável técnico) para o gestor. `clinics` só tinha
-- `clinics_read` (20260904000001_core_identity.sql) — sem policy de update,
-- a tela de configurações (app/gestor/configuracoes/dados-da-clinica) não
-- conseguia gravar nada, mesmo logado como gestor.

create policy clinics_update_by_gestor on clinics for update
  using (id = current_clinic_id() and app_current_role() = 'gestor')
  with check (id = current_clinic_id() and app_current_role() = 'gestor');
