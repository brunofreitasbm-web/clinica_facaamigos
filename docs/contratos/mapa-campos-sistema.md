# Mapa de campos: contrato de pacote mensal particular x sistema

MODELO EM STAND-BY — NÃO USAR SEM REVISÃO DE ADVOGADO

Fontes lidas: `supabase/migrations/20260908050000_new_modules.sql` (tabela `patient_contracts`), `20261031234723_particular_package_billing.sql` (função `generate_package_invoices`), `app/gestor/contratos/actions.ts`, `lib/particular-plans-pure.ts`, `supabase/migrations/20260904000002_patients.sql` (`patients`, `guardians`), `20260906000022_family_lgpd_consent.sql`, `20260913020000_document_signatures.sql`, `CNPJ NOVO.pdf` e `landing_page_faca_amigos/src/data/marca.json`.

Legenda da coluna "Situação": **OK** = existe e mapeia direto; **DERIVADO** = calculado a partir de outro dado; **FIXO** = configuração da clínica, igual em todo contrato; **LACUNA** = não existe coluna hoje.

## 1. Contrato e cobrança (`patient_contracts` / `contract_invoices`)

| Variável | Coluna / tabela | Origem do dado | Situação |
|---|---|---|---|
| `{{contrato_numero}}` | `patient_contracts.id` (uuid); número sequencial não existe | Gerado ao criar o contrato em `/gestor/contratos` | LACUNA (usar os 8 primeiros caracteres do id ou criar sequência) |
| `{{plano_nome}}` | `insurer_price_tables.procedure_name` (linha `PART-PLANO-*`, sem o prefixo "Plano ") via `loadParticularPlanCatalog` | Catálogo de planos particulares (`CatalogPlan.name`) | OK, mas o contrato não guarda o código do plano; só `sessions_per_month` e `monthly_fee` |
| `{{sessoes_mes}}` | `patient_contracts.sessions_per_month` | Número de sessões da nota `session_frequency_note` do plano (`sessionsFromNote`) | OK |
| `{{valor_mensal}}` | `patient_contracts.monthly_fee` | Preço do plano no catálogo (a tela ignora o valor digitado e usa o do catálogo) | OK |
| `{{valor_mensal_extenso}}` | Nenhuma | Calculado na geração do documento a partir de `monthly_fee` | DERIVADO |
| `{{valor_sessao_ref}}` | `patient_contracts.unit_price` | `monthly_fee / sessions_per_month` (R$ 180,00 para 6 sessões e R$ 1.080,00) | OK (informativo) |
| `{{dia_vencimento}}` | `patient_contracts.payment_day` (usado na fatura manual) e `invoice_day` (usado no job mensal) | Campo "dia de vencimento" do formulário de novo contrato | OK, ver observação 1 |
| `{{dia_inicio_ciclo}}` | `patient_contracts.invoice_day` | Hoje não há campo próprio; sugestão: ciclo começa no dia do vencimento | LACUNA parcial, ver observação 1 |
| `{{data_inicio}}` | `patient_contracts.start_date` | Campo "início" do formulário | OK |
| `{{regra_primeiro_ciclo}}` | Nenhuma | Decisão do dono (integral ou proporcional) | LACUNA |
| Modalidade pacote | `patient_contracts.billing_mode = 'pacote'` e `plan_type = 'particular'` | `billingModeForPlan` (só o plano Encontro é `avulsa`) | OK. Este modelo só vale para `pacote` e `particular` |
| Competência de cada cobrança | `contract_invoices.reference_month`, `due_date`, `amount`, `status` | Job `generate_package_invoices` ou botão "gerar fatura" | OK |
| Meio de pagamento | `contract_invoices.pix_code`, `boleto_url` | Preenchidos na emissão; o contrato diz apenas "meio indicado pela CONTRATADA" | OK |
| Situação do contrato | `patient_contracts.status` (`ativo`, `suspenso`, `cancelado`, `encerrado`), `end_date` | `updateContractStatus` (preenche `end_date` em cancelado/encerrado) | OK (a "suspensão da agenda" da cláusula 7 não tem regra automática no sistema) |
| Observações livres | `patient_contracts.notes` | Campo de notas do formulário | OK |

**Observação 1 (vencimento antecipado).** A cláusula 5 exige pagamento antes do ciclo. Hoje a função `generate_package_invoices` cria a fatura com vencimento no dia `invoice_day` do próprio mês de referência, e `generateMonthlyInvoice` usa `payment_day` no mês corrente. Para o pagamento ser mesmo antecipado, é preciso decidir uma das duas: (a) o ciclo começa no dia `invoice_day` e a fatura vence nesse mesmo dia (então `dia_inicio_ciclo = dia_vencimento`); ou (b) a fatura é gerada no mês anterior. As colunas `invoice_day`, `billing_mode`, `sessions_per_month` e `unit_price` são usadas pela função e pelas actions, mas **não aparecem em nenhuma migration local** (a criação de `patient_contracts` só tem `payment_day`); confirmar no banco que existem e versionar a migration.

## 2. Responsável legal (CONTRATANTE) — `guardians`

| Variável | Coluna / tabela | Origem do dado | Situação |
|---|---|---|---|
| `{{responsavel_nome}}` | `guardians.full_name` | Cadastro do responsável (cadastro pelo WhatsApp/`registration_drafts` ou recepção). Escolher o responsável com `is_financial = true` | OK |
| `{{responsavel_cpf}}` | `guardians.cpf` | Idem | OK (coluna opcional; exigir no contrato) |
| `{{responsavel_rg}}` | `guardians.rg` | Adicionada em `20260907000001_registration_drafts.sql` | OK (opcional) |
| `{{responsavel_parentesco}}` | `guardians.relationship` | Cadastro do responsável | OK |
| `{{responsavel_telefone}}` | `guardians.phone` | Cadastro do responsável | OK |
| `{{responsavel_email}}` | `guardians.email` | Cadastro do responsável | OK (opcional) |
| `{{responsavel_endereco}}` | Nenhuma coluna em `guardians` | Conferir se existe em `registration_drafts` ou `patients`; senão coletar na assinatura | LACUNA |
| `{{responsavel_nacionalidade_estado_civil}}` | Nenhuma | Coletar na assinatura (ou remover do modelo se o advogado dispensar) | LACUNA |
| Responsável financeiro | `guardians.is_financial` | Marca quem assina e paga | OK |

## 3. Paciente — `patients`

| Variável | Coluna / tabela | Origem do dado | Situação |
|---|---|---|---|
| `{{paciente_nome}}` | `patients.full_name` | `patient_contracts.patient_id` | OK |
| `{{paciente_nascimento}}` | `patients.birth_date` | Idem | OK |
| CPF do paciente (se for incluído) | `patients.cpf` (a tela de contratos já lê `patients(full_name, cpf)`; a coluna não está nas migrations locais) | Cadastro | Conferir |

## 4. Clínica (CONTRATADA) — configuração fixa

| Variável | Valor atual | Origem | Situação |
|---|---|---|---|
| `{{clinica_razao_social}}` | INSTITUTO FACA AMIGOS LTDA | `CNPJ NOVO.pdf` (comprovante de inscrição emitido em 09/09/2026) | FIXO. Nome de fantasia na Receita é "CORPO TERAPIAS E FISIOTERAPIA", diferente de "FaçaAmigos"; confirmar |
| `{{clinica_cnpj}}` | 22.161.197/0001-83 | `marca.json` (`cnpj.instituto`) e `CNPJ NOVO.pdf` | FIXO. O `marca.json` tem outro CNPJ (66.318.630/0001-17) só para o Playground; não usar |
| `{{clinica_endereco}}` | Rua Boaventura da Silva, 1573, Umarizal, Belém/PA, CEP 66060-147 | `marca.json` (`unidades.clinica`) e `CNPJ NOVO.pdf` | FIXO |
| `{{clinica_whatsapp}}` | (91) 99178-2027 | `marca.json` (`unidades.clinica.whatsapp` = 5591991782027) | FIXO |
| E-mail | institutofacaamigos@gmail.com | `marca.json` (`site.email`) | FIXO |
| `{{clinica_representante_nome}}` e `{{clinica_representante_qualificacao}}` | [PREENCHER] | Contrato social (não está no repositório) | LACUNA |
| `{{encarregado_dados_contato}}` | [PREENCHER] | Definir o encarregado (LGPD) | LACUNA |

## 5. Regras do contrato sem coluna hoje (parâmetros a criar)

Sugestão: guardar como configuração global da clínica (tabela de parâmetros) e copiar o valor vigente para o contrato no momento da assinatura, para o contrato assinado não mudar depois.

| Variável | Valor sugerido | Observação |
|---|---|---|
| `{{duracao_sessao_min}}` | 40 | Da base do chatbot; Psicoterapia aparece com 30 min em `appointment_types` |
| `{{aviso_falta_horas}}` | 24 (ou 48) | Decisão do dono; chatbot hoje diz 24 h |
| `{{prazo_reposicao_dias}}` | [PREENCHER] (sugestão: 15) | Regra nova |
| `{{aviso_rescisao_dias}}` | [PREENCHER] (sugestão: 30) | Decisão do dono |
| `{{multa_mora_pct}}` / `{{juros_mora_pct_am}}` | 2 / 1 | Limites a confirmar com advogado |
| `{{dias_atraso_rescisao}}` | [PREENCHER] (sugestão: 30) | Decisão do dono |
| `{{indice_reajuste}}` / `{{mes_reajuste}}` | IPCA / mês de aniversário | Decisão do dono |
| `{{retencao_prontuario_anos}}` | 20 | A confirmar com advogado |
| `{{fidelidade_meses}}`, `{{beneficio_fidelidade}}`, `{{multa_fidelidade}}` | Não usar por padrão | Só na alternativa comentada |

## 6. Aceite, LGPD e imagem

| Variável / evento | Coluna / tabela | Origem do dado | Situação |
|---|---|---|---|
| `{{data_assinatura}}` | `document_signatures.signed_at` | Registro do aceite por OTP | OK |
| Assinante, CPF, telefone, IP, hash do documento | `document_signatures.signer_name`, `signer_cpf`, `signer_phone`, `signer_ip`, `document_hash` | Fluxo de assinatura por código (OTP) já existente para termos | OK (reaproveitar; exige um registro em `documents` para o contrato) |
| Consentimento LGPD (Anexo I) | `guardians.lgpd_consent_at` | Já existe no fluxo de consentimento da família | OK, mas hoje é um consentimento genérico; o Anexo I é mais específico, então guardar também a assinatura em `document_signatures` |
| Uso de imagem (Anexo II) | `guardians.image_consent`, `image_consent_updated_at` | Cadastro | **CONFLITO: `image_consent` tem DEFAULT true; o contrato diz que a imagem NÃO é autorizada por padrão.** Mudar o default para false ou tornar o valor explícito |
| `{{imagem_prazo}}`, `{{imagem_prazo_retirada_dias}}` | Nenhuma | Preenchidos no Anexo II, só se autorizado | LACUNA |
| `{{testemunha_1}}`, `{{testemunha_2}}` | Nenhuma | Opcional | LACUNA |

## 7. Pendências para implementação (fora do escopo deste trabalho)

1. Decidir a regra de vencimento antecipado (observação 1) e versionar as colunas `invoice_day`, `billing_mode`, `sessions_per_month`, `unit_price`, `reference_month` e `description` em migration.
2. Criar tabela de parâmetros do contrato (seção 5) e guardar o valor vigente em cada contrato assinado.
3. Corrigir o default de `guardians.image_consent`.
4. Não há hoje regra automática para "bloquear a agenda do ciclo sem pagamento" (cláusula 7) nem para contagem de sessões (avaliação = 1, bloco ABA = 3), nem para reposição. Verificar o que já existe no agendamento antes de prometer isso no contrato.
5. O plano "Passo Firme" (6 sessões, R$ 1.080,00) ainda não está no catálogo `PART-PLANO-*` listado na base do chatbot.
