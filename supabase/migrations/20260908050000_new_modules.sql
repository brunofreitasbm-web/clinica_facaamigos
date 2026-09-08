-- Migração para criação dos 4 novos módulos operacionais e de gestão
-- 1. Módulo de Glosas e Recursos de Convênio
-- 2. Módulo de Prontuário Eletrônico Único e Auditoria Clínico-Legal
-- 3. Módulo de Estoque e Almoxarifado Terapêutico
-- 4. Módulo de Gestão de Contratos e Cobrança Particular/Co-participação

-- ============================================================================
-- 1. GLOSAS E RECURSOS DE CONVÊNIO
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_disallowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  insurer_id UUID NOT NULL REFERENCES insurers(id) ON DELETE CASCADE,
  billing_item_id UUID REFERENCES billing_items(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  disallowance_code VARCHAR(50) NOT NULL,
  reason TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'identificada' CHECK (status IN ('identificada', 'em_analise', 'aguardando_lote', 'deferida', 'indeferida', 'perda_irrecuperavel')),
  appeal_deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS disallowance_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disallowance_id UUID NOT NULL REFERENCES billing_disallowances(id) ON DELETE CASCADE,
  justification TEXT NOT NULL,
  attached_document_ids UUID[] DEFAULT '{}',
  status VARCHAR(30) NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'em_processamento', 'aceito', 'rejeitado')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- RLS para Glosas
ALTER TABLE billing_disallowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE disallowance_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disallowances clinic scope policy" ON billing_disallowances
  FOR ALL USING (clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Disallowance appeals clinic scope policy" ON disallowance_appeals
  FOR ALL USING (
    disallowance_id IN (
      SELECT id FROM billing_disallowances WHERE clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- 2. ESTOQUE E ALMOXARIFADO TERAPÊUTICO
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('teste_psicologico', 'brinquedo_pedagogico', 'material_consumo', 'equipamento', 'outros')),
  quantity_available INT NOT NULL DEFAULT 0,
  min_quantity INT NOT NULL DEFAULT 5,
  unit_cost NUMERIC(10, 2) DEFAULT 0.00,
  location VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('entrada', 'saida')),
  quantity INT NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  related_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para Estoque
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory items clinic scope policy" ON inventory_items
  FOR ALL USING (clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Inventory movements clinic scope policy" ON inventory_movements
  FOR ALL USING (
    item_id IN (
      SELECT id FROM inventory_items WHERE clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- 3. GESTÃO DE CONTRATOS E COBRANÇA PARTICULAR/CO-PARTICIPAÇÃO
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('particular', 'reembolso_assistido', 'coparticipacao')),
  monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  payment_day INT NOT NULL CHECK (payment_day BETWEEN 1 AND 31),
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso', 'cancelado', 'encerrado')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES patient_contracts(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  pix_code TEXT,
  boleto_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para Contratos
ALTER TABLE patient_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient contracts clinic scope policy" ON patient_contracts
  FOR ALL USING (clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Contract invoices clinic scope policy" ON contract_invoices
  FOR ALL USING (
    contract_id IN (
      SELECT id FROM patient_contracts WHERE clinic_id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
    )
  );
