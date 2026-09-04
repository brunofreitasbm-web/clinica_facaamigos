# Schema núcleo (Fase 0, item 1 do backlog) — Design

**Data:** 2026-09-04
**Fonte:** `PRDsistemaclinicatea1.md` v1.3, §6, §7, §7.1, §9.4-A, §11, §14 (item 1)
**Escopo:** só banco de dados (migrations + triggers + RLS + testes pgTAP). Sem código de app.

## Contexto e decisões registradas nesta sessão

- O repositório estava vazio (zero commits) no início desta entrega. O §7.1 do PRD descreve migrations `20260904000001–000012` como "implementadas e testadas" — isso é tratado aqui como **especificação-alvo**, não como trabalho pré-existente. Confirmado pelo dono do produto.
- **Decisão de infraestrutura registrada:** o schema da clínica (dado de saúde de menor, retenção legal de 20 anos, LGPD art. 11) será anexado ao projeto Supabase `controle-de-estagiario` (`vththexblpxwocbowhsv`), que já está em produção com dados de outro domínio (91 registros em `interns`) e tem uma tabela (`public.workspaces`) com RLS desabilitado. Recomendação era projeto isolado; o dono do produto optou por anexar mesmo assim. Registrado aqui para rastreabilidade — mesma lógica do §9.4-A do PRD (decisão de risco do gestor, não reversão de recomendação técnica).
- `public.workspaces` (RLS desabilitado) é pré-existente e fora do escopo desta entrega; não será alterado sem pedido explícito.
- Sem Supabase CLI/Docker Supabase configurado neste ambiente. Testes pgTAP rodam **direto no projeto remoto** via extensão `pgtap` + `execute_sql`, não em stack local.

## Arquitetura

Um único schema Postgres (`public`) no projeto `vththexblpxwocbowhsv`, convivendo com as tabelas já existentes desse projeto (namespaces diferentes por nome de tabela — nenhuma colisão de nome identificada). Toda tabela clínica/financeira nova:

- tem `clinic_id` (schema já nasce multi-tenant-ready, UI é single-tenant — §2, §6);
- tem RLS habilitada, sem exceção;
- se for clínica ou financeira, é coberta pelo trigger genérico de `audit_log`.

## Componentes (migrations, em ordem de dependência)

1. **`clinics`, `profiles`, `rooms`, `therapist_contracts`** — base de identidade e vínculo. `profiles.id` referencia `auth.users`. `therapist_contracts` com `EXCLUDE USING gist` para não sobrepor vigência de faixa por terapeuta.
2. **`guardians`, `patients`, `patient_access`** — `guardians.profile_id` (ponte para `auth.users` do portal, achado do §7.1). `patient_access` é a tabela que a RLS usa para "terapeuta só vê seu paciente" e "responsável só vê seu filho".
3. **`insurers`, `insurer_price_tables`, `patient_insurance`, `authorizations`** — `insurer_price_tables` com `EXCLUDE USING gist` (preço não pode ter vigência sobreposta por procedimento). `authorizations.sessions_used` mantido por trigger (não `GENERATED`, por ser agregado de outra tabela — limitação do Postgres documentada no §7.1). `authorizations.previous_authorization_id` para `auth_first_pass`.
4. **`domain_taxonomy`, `protocols`, `protocol_items`, `protocol_assessments`** — `protocols.digitization_risk_accepted_by/at` obrigatório (NOT NULL) por instrumento comprado, não por item — corrige a inconsistência que o §7.1 relata ter sido descoberta durante a implementação. `profiles.esdm_certified` como pré-condição de RLS de leitura em itens do instrumento ESDM.
5. **`treatment_plans`, `plan_goals`, `programs`** — `programs` com constraint CHECK garantindo XOR entre `domain_taxonomy_id` e `protocol_item_id` (regra do §7: "exatamente um dos dois preenchido").
6. **`appointments`** — `EXCLUDE USING gist` para sala e para terapeuta (sem sobreposição de horário). Trigger de guard: recusa insert/update para `realizada` se `authorizations.status <> 'ativa'`, fora de vigência, ou `sessions_used >= sessions_authorized` — exceto quando `is_provisional = true` (achado do §7.1: marcação provisória não passa pelo guard nem conta `sessions_used`). `is_evaluation` para diferenciar avaliação inicial de terapia recorrente.
7. **`session_notes`, `trial_data`** — `session_notes` sem policy/permissão de `UPDATE` (só `INSERT`), `supersedes_id` para versionamento. Trigger que cria pendência (não modelada como tabela própria nesta entrega — fica para a fila de pendências da Fase 1) quando `appointments.status = 'realizada'` sem `session_notes` correspondente em 24h: aqui entra só a função que a fila vai consultar, não a UI de fila.
8. **`documents`** — categorias fixas por CHECK; `shared_with_family` como flag de exposição ao portal (Fase 2, mas coluna nasce aqui).
9. **`billing_periods`, `billing_items`, `glosas`** — trigger que impede `billing_items` para `appointments` sem `session_notes`. `billing_items.paid_at` (achado do §7.1, para `dso_days`).
10. **`payouts`, `payout_items`** — cálculo em si é Fase 1 (Edge Function); aqui só a estrutura.
11. **`targets`, `metric_snapshots`, `survey_responses`** — `survey_responses` é tabela nova do §7.1 (NPS trimestral).
12. **`messages`, `audit_log`, `record_access_log`** — `audit_log` com trigger genérico aplicado a todas as tabelas clínicas/financeiras acima; `record_access_log` separado, para leitura (LGPD, §11), não escrita.
13. **Função `patient_status_as_of(patient_id, data)`** — `SECURITY DEFINER` com guard próprio (checa que o `auth.uid()` chamador tem `patient_access` ou é supervisor/gestor do `clinic_id` do paciente) antes de reconstruir o status a partir do `audit_log`. Sem guard, um SECURITY DEFINER exporia status de qualquer paciente — risco que o §7.1 já sinaliza.

Cada migration é um arquivo `supabase/migrations/<timestamp>_<slug>.sql`, aplicado via `apply_migration` em ordem, um de cada vez, com verificação (`list_tables`/`execute_sql`) antes de seguir para o próximo.

## RLS (por papel, §4 + §9.4-A)

- **Dono/gestor**: leitura ampla por `clinic_id` em tudo; sem policy de escrita em `session_notes`/`trial_data` (evolução clínica é intocável mesmo pelo dono — regra explícita do §4).
- **Coordenador/supervisor**: leitura ampla por `clinic_id`; escrita em `treatment_plans` (aprovação), `plan_goals` (validação de meta), `appointments` (grade); sem escrita em valores financeiros (`payouts`, `insurer_price_tables`).
- **Terapeuta**: leitura/escrita restrita a `patient_access` onde `access_type = 'terapeuta'` e `profile_id = auth.uid()`; `session_notes` só INSERT, sem UPDATE, sem DELETE; sem leitura de `insurer_price_tables`/`payouts` de outros.
- **Recepção**: leitura ampla de `appointments`/`patients`/`authorizations`/`documents` por `clinic_id`; **sem** leitura de `session_notes`, `trial_data`, `protocol_items`, `protocol_assessments`, `payouts`.
- **Faturamento**: leitura de `appointments` (realizada), `authorizations`, `billing_periods`, `billing_items`, `glosas`; sem escrita em `appointments`/`session_notes`.
- **Responsável (família)**: leitura restrita a `patient_access` onde `access_type = 'responsavel'` e `profile_id = auth.uid()`, e só nas colunas/tabelas do §9.7 (agenda, frequência, metas traduzidas, documentos `shared_with_family = true`); **nunca** `session_notes.structured`/`free_text`, `protocol_items`, `protocol_assessments`, valores.
- **`protocol_items`/`protocol_assessments`** (§9.4-A): leitura só para supervisor/gestor e para terapeuta com certificação registrada no instrumento correspondente; nenhuma policy permite export/leitura por recepção, faturamento ou família — inclusive indiretamente (nenhuma view pública expõe essas colunas).

## Testes pgTAP (mínimo desta entrega)

1. Insert de `appointments` com `authorization_id` cuja `authorizations.status <> 'ativa'` → falha.
2. Insert de `appointments` com `sessions_used >= sessions_authorized` → falha; com `is_provisional = true` → sucesso e não incrementa `sessions_used`.
3. Duas `appointments` no mesmo `room_id` com horário sobreposto → falha (EXCLUDE gist). Mesmo teste para `therapist_id`.
4. `UPDATE` em `session_notes` → falha (sem policy/regra de update).
5. `billing_items` para `appointment` sem `session_notes` → falha.
6. RLS: terapeuta A não enxerga `appointments`/`patients` de paciente vinculado só ao terapeuta B.
7. RLS: responsável não enxerga `session_notes` nem `protocol_items` do próprio filho.
8. RLS: recepção não enxerga `session_notes` nem `protocol_items`.
9. RLS: terapeuta sem `esdm_certified = true` não enxerga `protocol_items` do protocolo `esdm`.
10. `programs`: insert com `domain_taxonomy_id` e `protocol_item_id` ambos preenchidos (ou ambos nulos) → falha (constraint XOR).

## Fora de escopo (explícito)

- Qualquer Edge Function (cálculo de repasse, fechamento de competência, WhatsApp).
- UI/Next.js.
- `expenses`, `availability_slots` — lacunas já assumidas como abertas pelo próprio §7.1, ficam para Fase 3/2.
- Alterar `public.workspaces` (RLS desabilitado, pré-existente, fora do domínio da clínica).
- Seed de dados além do mínimo necessário para os testes pgTAP.
