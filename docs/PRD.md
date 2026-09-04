# PRD — Sistema Proprietário de Gestão Clínica TEA/TDAH

**Versão:** 1.3 · **Data:** 04/09/2026 (revisão: §7.1 sincronizado com as migrations) · **Dono do produto:** TCel Bruno Freitas
**Stack decidida:** Next.js (Vercel) + Supabase (Postgres, Auth, RLS, Storage, Edge Functions) · construção própria assistida por IA
**Abertura da clínica:** ≤ 3 meses (meta: dezembro/2026)

---

## 0. Decisões que moldam este documento

| Pergunta | Resposta | Consequência no PRD |
|---|---|---|
| Fonte principal de receita | Planos de saúde | Autorização/guia é entidade central; glosa é métrica de faturamento; documentação é requisito de receita |
| Vínculo dos terapeutas | PJ, pagos por sessão realizada | Repasse calculado por sessão; tabela de valor-hora em faixas; nada de "bônus por meta" no contrato |
| Negócio | Novo, do zero | Sem migração de dados; sistema define o processo desde o dia 1 |
| Escala ano 1 | 15+ terapeutas, 100+ crianças | ~1.500–2.500 sessões/mês; agenda e prontuário precisam de performance e multiusuário desde o MVP |
| Quem constrói | O próprio dono, com IA + Supabase/Vercel | PRD vai até nível de schema, RLS e telas; prioriza o que uma pessoa constrói em 12 semanas |
| Prazo de abertura | ≤ 3 meses | Fase 0 e 1 são o MVP de abertura; tudo que não impede atender no dia 1 vai para Fase 2+ |
| TISS | Integrar com faturista/sistema externo | Sistema gera guias e exporta lote estruturado; XML TISS nativo é Fase 4 opcional |
| Modelo clínico | ABA com VB-MAPP + ABLLS-R + Denver/ESDM licenciados, comprados pela clínica, + multidisciplinar com metas livres + grupo/escola *(decisão revista em 04/09/2026: gestor confirmou compra dos três e aceite formal do risco de digitização — ver Decisão de Risco Registrada, §9.4-A)* | Plano terapêutico híbrido: item estruturado de protocolo licenciado para ABA/Denver, metas SMART por domínio próprio para as demais disciplinas; sessão com N pacientes |

---

## 1. Problema e objetivo

**Problema.** Clínicas de TEA no Brasil perdem receita em quatro vazamentos: falta/cancelamento sem recuperação, sessão realizada sem guia vigente, evolução não registrada ou registrada tarde (glosa), e evasão silenciosa de pacientes. Os sistemas de mercado tratam agenda e prontuário, mas nenhum liga esses vazamentos a metas por cargo, nem dá ao dono um painel de operação diário.

**Objetivo do sistema.** Transformar cada sessão em um registro rastreável do primeiro contato até o recebimento, e expor os vazamentos como métricas por cargo, para que a bonificação de recepção, coordenação e faturamento e a progressão de faixa dos terapeutas sejam calculadas automaticamente a partir de dados, não de percepção.

**Métrica de sucesso do produto (12 meses):**

- 0 sessões realizadas sem autorização vigente (bloqueio no agendamento)
- ≥ 98% das evoluções registradas em até 24h
- Glosa ≤ 4% do faturado
- No-show ≤ 8% com recuperação ≥ 40%
- Tempo de registro de evolução ≤ 2 min por sessão (medido no app)
- Todo indicador de bonificação calculado por view SQL, sem planilha manual

## 2. Não-objetivos (v1)

- Faturamento TISS nativo (XML, versionamento ANS, homologação por operadora) — Fase 4, só se o custo do faturista justificar
- Prescrição médica, receituário, laudo médico (a clínica não é prestador médico)
- Contabilidade/fiscal (NFS-e sai do sistema do contador ou de emissor externo; integração em Fase 3)
- Telessessão nativa com vídeo (link externo registrado na sessão é suficiente em v1)
- Multi-clínica / franquia (schema já nasce com `clinic_id`, mas UI é single-tenant)

## 3. Princípios de produto

1. **Uma sessão só existe se tiver guia vigente, terapeuta, sala e paciente.** O sistema bloqueia, não avisa.
2. **Evolução em 2 minutos.** Se o terapeuta precisa de mais que isso, o formulário está errado. Campos estruturados primeiro, texto livre por último, ditado por voz opcional.
3. **Tudo tem autor, hora e versão.** Nenhum registro clínico ou financeiro é sobrescrito; é versionado.
4. **Terapeuta não é vendedor.** Nenhuma métrica do sistema recompensa volume prescrito, horas indicadas ou adiamento de alta. Isso é regra de produto, não só de RH.
5. **Pais veem progresso, não prontuário.** Portal expõe metas, frequência, agenda e documentos liberados; nunca a evolução bruta.
6. **Papel define tela.** Recepção, terapeuta, supervisor, faturamento e dono têm home diferentes. Ninguém navega por menu para achar o trabalho do dia.

## 4. Papéis e permissões

| Papel | O que vê | O que faz | Não pode |
|---|---|---|---|
| **Dono/Gestor** | Tudo, painel executivo | Configura metas, faixas de valor-hora, convênios, aprova repasse | Editar evolução clínica |
| **Coordenador clínico / Supervisor** | Todos os pacientes, todas as agendas, painel de supervisão | Monta grade, aprova plano terapêutico, valida metas atingidas, autoriza alta | Alterar valores financeiros |
| **Terapeuta (PJ)** | Só seus pacientes e sua agenda | Registra evolução, coleta dados, propõe metas, anexa relatório | Ver agenda de outros, ver valores de convênio, editar evolução após 48h sem justificativa |
| **Recepção** | Agenda geral, cadastro, fila de pendências, autorizações | Cadastra, agenda, confirma, registra falta, anexa documentos de entrada | Ver evolução clínica, ver repasse |
| **Faturamento** | Sessões realizadas, guias, lotes, glosas | Fecha competência, exporta lote, registra retorno de glosa, abre recurso | Editar sessão ou evolução |
| **Responsável (pai/mãe)** | Portal: agenda do filho, frequência, metas, documentos liberados, mensagens | Confirma sessão, justifica falta, envia documento, responde questionário | Ver evolução, ver outros pacientes |

Implementação: `profiles.role` + tabela `patient_access` (terapeuta↔paciente, responsável↔paciente) + RLS em todas as tabelas. Supervisor e gestor têm policy de leitura ampla por `clinic_id`.

## 5. O que o mercado atende e o que não atende

Levantamento de set/2026 (ComportaTUDO, Cliniconect, BlueSmiles, CollectABA).

| Necessidade | Mercado atende? | Detalhe | Proprietário |
|---|---|---|---|
| Agenda multidisciplinar recorrente | Sim | Todos | Fase 0 |
| Prontuário eletrônico | Sim | Todos | Fase 0 |
| Repasse por sessão | Sim | ComportaTUDO, Cliniconect | Fase 1 |
| Faturamento TISS | Parcial | Cliniconect sim; ComportaTUDO/BlueSmiles não anunciam | Exportação estruturada Fase 1; nativo Fase 4 |
| Coleta de dados ABA por programa/tentativa | Sim | ComportaTUDO, CollectABA, BlueSmiles | Fase 2 |
| Protocolos comerciais (VB-MAPP/ABLLS-R/Denver) | Parcial | BlueSmiles anuncia suporte; clínica compra os três instrumentos e contrata terapeuta já certificado em ESDM para aplicar Denver | Fase 2, com risco de digitização aceito pelo gestor — ver §9.4-A |
| Portal/app da família | Sim | ComportaTUDO, BlueSmiles | Fase 2 |
| Bloqueio de agendamento sem guia vigente | **Não confirmado em nenhum** | Ponto crítico de glosa | Fase 1 |
| Motivo de falta e quem cancelou (família/terapeuta/clínica) | **Não confirmado** | Sem isso não há métrica de recepção nem de terapeuta | Fase 0 |
| Timestamp de evolução vs. hora da sessão | **Não** | Necessário para "evolução em 24h" | Fase 0 |
| Glosa por motivo, por convênio, por terapeuta | Parcial | Cliniconect tem relatórios; motivo atribuível não confirmado | Fase 3 |
| Métricas por cargo ligadas a metas de bonificação | **Não** | ComportaTUDO tem dashboard de produtividade só em plano superior; nenhum calcula PLR/faixa | Fase 3 |
| Painel de supervisão (carteira, metas vencidas, pendências por terapeuta) | Parcial | Dashboards genéricos | Fase 2 |
| Fila de pendências da recepção (cadastro incompleto, guia vencendo) | **Não** | | Fase 1 |
| Rastreabilidade com versionamento e log de auditoria | Parcial | Nenhum expõe log ao gestor | Fase 0 |
| Exportação CSV/API completa | Parcial | Não confirmado | Nativo (é o nosso banco) |
| Sessão em grupo / escola | Parcial | | Fase 4 |
| Custo | — | ComportaTUDO: R$ 59,90–99,90/paciente/mês → R$ 6–10 mil/mês em 100 crianças | Supabase Pro + Vercel Pro + WhatsApp API ≈ R$ 400–900/mês |

**Conclusão:** o mercado cobre o núcleo clínico (Fases 0–2) razoavelmente; não cobre o que gera o modelo de negócio (Fases 1 e 3: bloqueio por guia, motivo de falta, métricas por cargo, bonificação). O proprietário se justifica por esses módulos e pelo custo em escala. O risco é reconstruir mal o que o mercado já faz bem; por isso Fases 0–2 copiam padrões consolidados e não inovam.

## 6. Arquitetura

```
[Next.js App Router - Vercel]
  ├── /recepcao      (desktop-first)
  ├── /terapeuta     (PWA mobile-first, offline-tolerant para evolução)
  ├── /supervisao    (desktop)
  ├── /faturamento   (desktop)
  ├── /gestor        (desktop + mobile resumo)
  └── /familia       (mobile-first, login por telefone/OTP)
          │
[Supabase]
  ├── Postgres + RLS  (fonte única de verdade)
  ├── Auth            (e-mail/senha p/ equipe; OTP SMS/WhatsApp p/ família)
  ├── Storage         (anexos: buckets privados por paciente, URLs assinadas)
  ├── Edge Functions  (WhatsApp, cálculo de repasse, fechamento de competência, exportação de lote)
  ├── pg_cron         (jobs: guia vencendo, evolução pendente, confirmação D-1)
  └── Views/materialized views (todas as métricas)
          │
[Integrações]
  ├── WhatsApp Business Cloud API (Meta) ou Z-API   → confirmação, lembrete, portal
  ├── Faturista / sistema TISS externo               → exportação CSV/XLSX de lote + retorno de glosa (importação)
  ├── Emissor NFS-e (Fase 3)                         → repasse PJ / particular
  ├── Metabase (self-host) ou Looker Studio (Fase 3) → BI sobre views
  └── Google Calendar (opcional, leitura)            → agenda pessoal do terapeuta
```

Decisões técnicas fixas:

- **Um banco, sem microserviços.** Toda métrica é `SELECT` sobre views. Se um dado não está no Postgres, não existe.
- **Soft delete + tabela `audit_log`** (trigger genérico em todas as tabelas clínicas e financeiras: `table, row_id, action, actor_id, before, after, at`).
- **Evolução é append-only:** `session_notes` tem `version`; edição cria nova linha com `supersedes_id`.
- **Storage por paciente:** bucket `patients/{patient_id}/{category}/{uuid}.{ext}`; metadados em `documents`.
- **Offline-first no app do terapeuta:** rascunho de evolução em IndexedDB, sincroniza ao reconectar; timestamp de criação é o do dispositivo, timestamp de sincronização é o do servidor (ambos guardados).

## 7. Modelo de dados (núcleo)

```
clinics(id, name, cnpj, ...)
profiles(id→auth.users, clinic_id, role, full_name, council_type, council_number, phone, active)
therapist_contracts(id, profile_id, tier, hourly_rate, valid_from, valid_to)        -- faixa de valor-hora
rooms(id, clinic_id, name, capacity)

patients(id, clinic_id, full_name, birth_date, cid, support_level, status[lead|avaliacao|ativo|pausado|alta|evadido], entry_source, complaint, created_by, created_at, first_contact_at, evaluated_at, first_session_at)
patient_access(id, patient_id, profile_id, access_type[terapeuta|responsavel|supervisor], granted_by, granted_at, revoked_at)
guardians(id, patient_id, full_name, phone, email, cpf, relationship, is_financial, portal_enabled)
insurers(id, name, ans_code, billing_rules jsonb)          -- convênio
insurer_price_tables(id, insurer_id, procedure_code, procedure_name, price, valid_from, valid_to)
patient_insurance(id, patient_id, insurer_id, card_number, card_valid_until, plan_name, is_private boolean)

authorizations(id, patient_insurance_id, guide_number, procedure_code, sessions_authorized, sessions_used (computed), valid_from, valid_to, status[pendente|ativa|esgotada|vencida|negada], requested_at, approved_at, document_id)

treatment_plans(id, patient_id, version, status[rascunho|aprovado|encerrado], approved_by, approved_at, review_due_at, discipline_mix jsonb)
plan_goals(id, treatment_plan_id, discipline, domain, description, criterion, baseline, target, status[ativa|atingida|suspensa], achieved_at, validated_by)
domain_taxonomy(id, clinic_id, discipline, domain, description)   -- vocabulário próprio da clínica para disciplinas sem protocolo licenciado: comunicação, social, autonomia, cognição, motor, comportamento
protocols(id, clinic_id, name[vbmapp|ablls_r|esdm], version, license_purchased_at, license_note, digitization_risk_accepted_by, digitization_risk_accepted_at)   -- ver §9.4-A: digitização feita sem autorização por escrito da editora, risco aceito e registrado pelo gestor
protocol_items(id, protocol_id, domain, level, item_code, description)   -- descrição transcrita do material licenciado; acesso restrito, nunca exportável (ver RLS em §9.4-A)
protocol_assessments(id, patient_id, protocol_id, assessed_at, assessed_by, scores jsonb)
programs(id, plan_goal_id, domain_taxonomy_id, protocol_item_id, name, target_type[tentativa|duracao|frequencia|tarefa], mastery_criterion)   -- domain_taxonomy_id para disciplinas livres, protocol_item_id para ABA/Denver; exatamente um dos dois preenchido

appointments(id, patient_id, therapist_id, room_id, authorization_id, discipline, starts_at, ends_at, modality[individual|grupo|escola|remoto], group_id, recurrence_id, status[agendada|confirmada|realizada|falta_familia|cancelada_familia|cancelada_terapeuta|cancelada_clinica|remarcada], cancel_reason, cancelled_by, cancelled_at, confirmed_at, confirmed_via, checkin_at, checkout_at)

session_notes(id, appointment_id, therapist_id, version, supersedes_id, structured jsonb, free_text, created_at_device, created_at_server, signed_at)
trial_data(id, appointment_id, program_id, trial_index, result[correto|incorreto|ajuda|nao_aplicado], prompt_level, duration_s, recorded_at)

documents(id, patient_id, category[pedido_medico|laudo|carteirinha|termo|relatorio_evolucao|reavaliacao|autorizacao|outro], storage_path, uploaded_by, uploaded_at, valid_until, shared_with_family boolean)

billing_periods(id, insurer_id, competence_month, status[aberta|fechada|enviada|paga], exported_at, exported_file_id)
billing_items(id, billing_period_id, appointment_id, procedure_code, amount, status[pendente|enviado|pago|glosado|recursado|recuperado])
glosas(id, billing_item_id, reason_code, reason_text, attributable_to[terapeuta|recepcao|faturamento|operadora], attributable_profile_id, amount, appealed_at, recovered_amount)

payouts(id, therapist_id, competence_month, sessions_count, gross_amount, adjustments, status)
payout_items(id, payout_id, appointment_id, rate_applied)

targets(id, clinic_id, role, metric_key, period[mensal|trimestral|semestral], target_value, weight)
metric_snapshots(id, metric_key, scope_type[clinica|profile|insurer], scope_id, period_start, period_end, value, computed_at)

messages(id, patient_id, guardian_id, channel[whatsapp|portal], direction, template_key, body, sent_at, delivered_at, read_at, related_appointment_id)
audit_log(id, table_name, row_id, action, actor_id, before jsonb, after jsonb, at)
```

Regras de integridade que viram constraint ou trigger:

- `appointments.authorization_id` obrigatório quando `patient_insurance.is_private = false`; trigger recusa insert se `authorizations.status <> 'ativa'` ou `starts_at` fora de `valid_from..valid_to` ou `sessions_used >= sessions_authorized`.
- `appointments.status = 'realizada'` exige `checkin_at` e cria pendência de `session_note` (job cobra em 24h).
- `session_notes` não aceita `UPDATE`; só `INSERT` com `supersedes_id`.
- `billing_items` só é criado para `appointments.status = 'realizada'` com `session_notes` existente (sem evolução, não fatura).
- `glosas.attributable_to` obrigatório ao registrar retorno; é o que alimenta a métrica por cargo.

### 7.1 Adições feitas na implementação (migrations 20260904000001–000012)

Ao converter o modelo acima em SQL, o §7 mostrou lacunas que a prosa escondia. Cada item abaixo está implementado e testado; o §7 acima é a intenção, este bloco é o que existe de fato.

| Adição | Onde | Por quê |
|---|---|---|
| `guardians.profile_id` | guardians | Ponte entre o responsável e o login do portal (auth.users); sem isso a RLS de responsável não tinha como saber "qual filho é seu" |
| `appointments.is_provisional` | appointments | §9.1 descrevia "marcação provisória enquanto a guia está pendente" sem nomear a coluna; provisória não conta `sessions_used` nem passa pelo guard de autorização |
| `appointments.is_evaluation` | appointments | `eval_show_rate` e `lead_to_eval_rate` (§10.1) precisam distinguir avaliação inicial de terapia recorrente |
| `authorizations.previous_authorization_id` | authorizations | `auth_first_pass` (§10.2) precisa separar "aprovada de primeira" de "aprovada após reenvio" |
| `billing_items.paid_at` | billing_items | `dso_days` (§10.4) mede até o pagamento; havia status `pago` mas nenhuma data |
| `profiles.esdm_certified` | profiles | Pré-condição de Denver/ESDM (§9.4-A): item de protocolo `esdm` só é visível a terapeuta certificado |
| `survey_responses` (tabela nova) | — | §9.7 falava em NPS trimestral, §7 nunca criou onde guardar a resposta; alimenta `family_nps` (§10.3) |
| `record_access_log` (tabela nova) | — | LGPD (§11): registro de quem abriu qual prontuário e quando, separado do `audit_log` de escrita |
| `sessions_used` mantido por trigger | authorizations | O §7 dizia "computed"; Postgres `GENERATED` só aceita expressão da própria linha, não agregado de `appointments` |
| `patient_status_as_of(patient_id, data)` | função | `churn_rate`, `active_patients`, `retention_90d` perguntam "qual era o status EM tal data"; reconstruída do `audit_log` com checagem de autorização própria (SECURITY DEFINER sem guard abriria consulta de status de qualquer paciente) |
| 3 constraints `EXCLUDE USING gist` | appointments, therapist_contracts, insurer_price_tables | Sala e terapeuta não podem ter duas sessões sobrepostas; faixa de contrato e preço de convênio não podem ter vigências sobrepostas |

Lacunas que **continuam abertas** e afetam o §10 (decisão consciente de não inventar número):

- Não existe tabela de **despesas fixas**. `cost_per_session` e `ebitda_margin` (§10.5) só fecham como aproximação: custo variável = repasse (`payouts`), margem = receita − repasse (margem de contribuição, não EBITDA). Tabela `expenses` fica para a Fase 3.
- Não existe tabela de **capacidade/disponibilidade** (grade de horários por sala e por terapeuta). `occupancy_rate` e `room_occupancy` (§10.2) usam "horas agendadas" como denominador, não "horas disponíveis". Ocupação real exige `availability_slots` — Fase 2.
- `data_collection_rate` (§10.3) depende do formato do `session_notes.structured` (chave `metas_trabalhadas`), que é contrato da aplicação, não do schema. Se o front mudar o nome da chave, a métrica quebra em silêncio; exige teste automatizado.
- `report_on_time` (§10.3) atribui a obrigação de relatório a **todos** os terapeutas com `patient_access` ao paciente, porque `treatment_plans.review_due_at` não tem dono por disciplina. Numa equipe multidisciplinar isso conta a mesma pendência para 3–4 pessoas.

## 8. Fases de implantação

Critério de corte: **o que impede atender e faturar no dia 1 é Fase 0/1; o resto é depois.** Cada fase tem entrega, critério de aceite e o que acontece se atrasar.

### Fase 0 — Núcleo operacional (semanas 1–6)

**Objetivo:** cadastrar, agendar, registrar sessão e evolução com rastreabilidade. É o mínimo para atender o primeiro paciente.

| Entrega | Detalhe |
|---|---|
| Auth + papéis + RLS | Equipe por e-mail/senha; policies por papel e `patient_access` |
| Cadastro de paciente em fluxo contínuo | Ver §9.1 |
| Cadastro de convênio, tabela de preço, autorização | CRUD; validação de vigência |
| Agenda | Semanal por terapeuta e por sala; recorrência; arrastar/soltar; conflito de sala/terapeuta bloqueado |
| Sessão | Check-in/check-out pela recepção ou pelo terapeuta; status com motivo e autor obrigatórios |
| Evolução rápida | Ver §9.4; append-only; timestamps duplos |
| Anexos | Upload por categoria; validade; visualização inline (PDF/imagem) |
| Audit log | Trigger genérico; tela de consulta para gestor |

**Aceite:** recepção cadastra um paciente novo com convênio, guia e pedido médico em ≤ 5 min; agenda 8 sessões recorrentes; terapeuta registra evolução no celular em ≤ 2 min; gestor vê quem alterou o quê.

**Se atrasar:** abertura em planilha + WhatsApp por até 4 semanas com importação posterior (script de import CSV faz parte da Fase 0).

### Fase 1 — Abertura e receita (semanas 7–12)

**Objetivo:** não perder sessão nem guia; entregar ao faturista um lote limpo.

| Entrega | Detalhe |
|---|---|
| Bloqueio de agendamento sem guia vigente | Trigger + UI explicando o motivo e o que falta |
| Fila de pendências da recepção | Ver §9.1: cadastro incompleto, guia vencendo em 15 dias, guia com ≤ 4 sessões, evolução pendente > 24h, documento vencido |
| Confirmação D-1 via WhatsApp | Template aprovado; resposta "1" confirma, "2" abre reagendamento; registro em `messages` |
| Registro de falta com motivo e autor | Obrigatório; alimenta no-show e cancelamento por origem |
| Reagendamento de falta (recuperação) | Sugestão automática de horário vago na mesma semana com o mesmo terapeuta |
| Fechamento de competência | Lista sessões realizadas com evolução; marca inconsistências; gera `billing_period` |
| Exportação para faturista | CSV/XLSX por convênio: paciente, carteirinha, guia, procedimento, data, hora, profissional, conselho, valor. Layout acordado com o faturista antes de codar |
| Importação de retorno de glosa | Planilha do faturista → `glosas` com motivo e atribuição |
| Repasse por sessão | Cálculo mensal por terapeuta com faixa vigente; extrato PDF |
| Home por papel | Recepção: agenda do dia + pendências; Terapeuta: minhas sessões de hoje + evoluções pendentes |

**Aceite:** zero sessão realizada sem guia na competência de teste; lote exportado aceito pelo faturista sem retrabalho; retorno de glosa importado e atribuído.

### Fase 2 — Qualidade clínica e família (meses 4–6)

| Entrega | Detalhe |
|---|---|
| Plano terapêutico por metas | Metas SMART por disciplina; versão; aprovação do supervisor; data de reavaliação (3/6/12 meses) |
| Coleta ABA | Programas por meta; registro de tentativa em toque único (correto/incorreto/ajuda); gráfico de aquisição por programa; critério de domínio automático |
| Protocolos | `protocol_items` com transcrição de VB-MAPP, ABLLS-R e ESDM (checklist por marco; pontuação por avaliação; gráfico de evolução entre avaliações) para disciplinas com protocolo; `domain_taxonomy` para as demais. Transcrição feita sem autorização por escrito da editora — risco aceito e registrado (§9.4-A); acesso à tabela restrito por RLS a supervisor e ao terapeuta certificado |
| Painel de supervisão | Ver §9.6 |
| Portal da família | Ver §9.7 |
| Relatório de evolução para o convênio | Gerado a partir das metas, frequência e dados coletados; PDF assinado; anexado ao paciente e enviado à recepção para protocolar |
| Alertas de reavaliação | Job 30/15/7 dias antes; bloqueia nova autorização se relatório vencido |

**Aceite:** supervisor aprova plano; terapeuta coleta 20 tentativas em uma sessão sem sair da tela; relatório de reavaliação sai em 1 clique com dados reais; família confirma sessão e vê metas do trimestre.

### Fase 3 — Metrificação e bonificação (meses 7–9)

| Entrega | Detalhe |
|---|---|
| Views de métricas | Todas as métricas do §10 como views SQL, com escopo clínica/profissional/convênio e período |
| Cadastro de metas por cargo | `targets` com peso; período mensal/trimestral/semestral |
| Cálculo de atingimento | Job mensal grava `metric_snapshots`; tela mostra realizado × meta × peso × % atingido por pessoa |
| Extrato de PLR (recepção/administrativo CLT) | Semestral, com memória de cálculo exportável para o acordo de PLR |
| Progressão de faixa (terapeuta PJ) | Trimestral: critérios objetivos (documentação, assiduidade, retenção, progresso clínico validado) → proposta de mudança de faixa para o gestor aprovar; nunca automático |
| Glosa por motivo/convênio/pessoa | Painel + recurso com prazo |
| BI | Metabase self-host apontando para views (ou Looker Studio via conector Postgres) |
| NFS-e (opcional) | Integração com emissor para particulares e repasse PJ |

**Aceite:** gestor abre o painel no dia 1 do mês e vê PLR e faixas calculadas sem planilha; toda métrica é auditável até a sessão que a compôs.

### Fase 4 — Expansão (meses 10–12)

| Entrega | Detalhe |
|---|---|
| Sessão em grupo / escola | `group_id`; N pacientes por sessão; evolução por paciente; faturamento por procedimento de grupo |
| Telessessão | Link de vídeo externo registrado; modalidade `remoto`; regras de faturamento por convênio |
| TISS nativo (só se justificar) | Geração de XML por versão ANS; validação; envio; retorno |
| Multi-unidade | UI por `clinic_id` |
| Integração agenda pessoal | Google Calendar leitura |

## 9. Requisitos por módulo

### 9.1 Recepção: cadastro em fluxo contínuo

Princípio: **cadastro nunca bloqueia; pendência sim.** A recepção cria o paciente com nome e telefone do responsável em 30 segundos e o sistema abre uma **ficha de pendências** que só zera quando tudo que o faturamento precisa está anexado.

Fluxo:

1. **Lead** (telefone/WhatsApp/Instagram/indicação): nome da criança, idade, responsável, telefone, origem, queixa em uma linha. Status `lead`. Timestamp de criação e de primeiro retorno humano (métrica "tempo de primeira resposta").
2. **Avaliação agendada:** vira `avaliacao`; agenda de avaliação com o coordenador; confirmação D-1.
3. **Avaliação realizada:** coordenador registra; sistema pede os documentos de entrada (checklist): pedido médico com CID, carteirinha, documento do responsável, termo de consentimento LGPD, termo de imagem (opcional), contrato de prestação (particular).
4. **Autorização:** recepção registra guia; enquanto `pendente`, agenda só permite marcação "provisória" que vira sessão real ao aprovar.
5. **Grade montada:** coordenador aloca terapeutas e salas; paciente vira `ativo` na primeira sessão realizada.

Tela da recepção (home):

- Coluna esquerda: agenda do dia por sala, com status colorido (confirmada / a confirmar / em atendimento / falta / cancelada).
- Coluna direita: **fila de pendências** ordenada por urgência: guia vencendo, guia com poucas sessões, cadastro incompleto, evolução pendente > 24h (para cobrar terapeuta), documento vencido, lead sem retorno > 15 min.
- Busca global por nome da criança, nome do responsável, telefone, carteirinha.
- Ações em um clique: confirmar, registrar falta (abre motivo e quem), reagendar (sugere vaga), anexar documento (câmera do celular ou arquivo).

Critérios de aceite: cadastro mínimo em ≤ 30 s; ficha completa em ≤ 5 min; nenhuma pendência some sem ação registrada com autor.

### 9.2 Agenda e controle de sessões

- Visões: por terapeuta, por sala, por paciente, geral do dia.
- Recorrência semanal com exceções (feriados, férias do terapeuta).
- Regras de bloqueio: conflito de sala, conflito de terapeuta, guia inválida, paciente pausado.
- Cada sessão consome 1 unidade da autorização ao ser `realizada`; `sessions_used` é coluna computada, não contador manual.
- Status são exclusivos e exigem autor + motivo quando negativos. Motivos padronizados de cancelamento: doença da criança, transporte, esquecimento, viagem, sem justificativa, terapeuta indisponível, sala indisponível, clínica fechada, outro (texto).
- Check-in pela recepção (chegou) e check-out (saiu) geram `checkin_at/checkout_at`; duração real fica disponível para auditoria de convênio.
- Sessão "realizada" sem evolução em 24h aparece na fila da recepção e do supervisor.

### 9.3 Autorizações e guias

- Uma autorização = um número de guia, um procedimento, N sessões, vigência.
- Alertas: 15 dias antes do vencimento; ≤ 4 sessões restantes; pedido de renovação com checklist do que a operadora exige (relatório de evolução, pedido médico atualizado).
- Histórico de pedidos e respostas por operadora (tempo de aprovação vira métrica).
- Anexo obrigatório: PDF/imagem da guia aprovada.

### 9.4 Evolução: facilidade de preenchimento

Meta: **≤ 2 minutos, no celular, sem digitar mais que uma frase.**

Formulário estruturado por disciplina (configurável pelo supervisor):

- Presença e engajamento (escala 1–5 em toque)
- Metas trabalhadas (checkbox das metas ativas do plano; já vem pré-marcado com as da sessão anterior)
- Resultado por meta (não iniciou / em aquisição / atingiu com ajuda / independente)
- Comportamentos-alvo observados (lista configurável; intensidade)
- Orientação dada à família (chips: rotina, comunicação, alimentação, sono, escola, nenhuma)
- Texto livre (opcional) com ditado por voz do próprio dispositivo
- Anexar foto/vídeo curto (opcional; consentimento de imagem verificado)
- Assinatura digital (confirmação com PIN) → `signed_at`

Regras:

- Rascunho salvo automaticamente a cada campo; funciona offline.
- Após assinatura, edição só por nova versão com justificativa; a anterior fica visível ao supervisor.
- Evolução gera automaticamente uma linha resumida no relatório de evolução para o convênio.
- O sistema mede o tempo entre abrir e assinar (métrica interna de UX).

### 9.4-A Protocolos licenciados: decisão de risco registrada e salvaguardas

**Decisão de Risco Registrada — 04/09/2026.** O gestor (TCel Bruno Freitas) confirmou a compra dos três instrumentos (VB-MAPP, ABLLS-R, Denver/ESDM) e optou por digitalizar o conteúdo dos itens no sistema próprio sem solicitar autorização por escrito às editoras (AVB Press, WPS, Guilford/Routledge). Isso é feito com conhecimento de que:

- A AVB Press declara em seus FAQs que o Guia e o Protocolo do VB-MAPP "não podem ser reproduzidos para distribuição ou uso múltiplo por qualquer meio eletrônico ou por sistema de armazenamento ou recuperação de informação". Transcrever os itens para o Postgres da clínica é, textualmente, o que essa cláusula veda.
- WPS (ABLLS-R) não publica a mesma proibição explícita, mas também não oferece licença de digitização para software de terceiro; o risco é de natureza semelhante, com menor probabilidade de fiscalização documentada.
- O risco é civil (ação por infração de direito autoral movida pela editora), não penal, e proporcional ao quanto o conteúdo circula: manter os itens dentro do sistema interno da clínica, sem exportar, sem expor ao portal da família e sem revender/replicar para outra clínica, é uma exposição materialmente menor do que publicar ou distribuir o conteúdo — mas não é exposição zero, e a decisão pode ser revista a qualquer momento pedindo autorização por escrito, o que muda a tabela `protocols.license_note` sem alterar o schema.

Isso não é uma recomendação técnica minha revertida por decisão sua — é uma decisão de risco jurídico que só o gestor pode tomar, e este documento existe para que ela fique registrada com data, autor e alternativa que foi preterida, caso precise ser defendida depois.

**Salvaguardas mínimas que o sistema aplica independente da decisão de risco:**

- `protocols.digitization_risk_accepted_by/at` grava quem autorizou e quando — não é opcional, é obrigatório no schema (a decisão é por instrumento comprado, não por item individual; corrigido em 04/09/2026 durante a implementação das migrations, que expôs a inconsistência com a versão anterior deste parágrafo).
- RLS em `protocol_items` e `protocol_assessments`: leitura só para supervisor e para o(s) terapeuta(s) certificado(s) no instrumento correspondente (`profiles.council_type`/campo de certificação); recepção, faturamento e família nunca têm acesso, nem indireto via relatório exportado.
- Nenhuma rota do sistema gera PDF, e-mail ou export contendo o texto do item — apenas a pontuação e o gráfico de aquisição saem em relatórios (inclusive o relatório de evolução para o convênio, que já não precisa do texto do item para justificar a cobertura).
- Portal da família (§9.7) nunca exibe nome ou descrição de item de protocolo, só a meta traduzida em linguagem para pais — a mesma regra que já existia para evolução clínica em geral.

**Taxonomia própria continua existindo em paralelo (`domain_taxonomy`)** para as disciplinas e metas que não vêm de nenhum dos três instrumentos — fonoaudiologia, terapia ocupacional e psicologia continuam registrando metas SMART livres como descrito na versão anterior deste documento; só ABA (VB-MAPP/ABLLS-R) e a parte de currículo do Denver usam `protocol_items`.

**Pré-condição de contratação:** o módulo Denver/ESDM (`protocols.name = 'esdm'`) só é ativado para um paciente quando o `program.therapist_id` responsável tem certificação ESDM registrada em `profiles`; o sistema bloqueia associar sessão de currículo Denver a terapeuta sem essa certificação. Isso resolve a folga de prazo: a clínica abre com VB-MAPP e ABLLS-R (aplicáveis por qualquer terapeuta ABA treinado internamente) e ativa Denver quando o terapeuta certificado for contratado, sem depender de treinar a equipe toda a tempo da abertura.

**Consequência no cronograma:** a Fase 2 (§8) ganha de volta a construção de `protocol_items` e importação de itens (agora com o texto real, transcrito manualmente do livro comprado — trabalho de digitação da equipe clínica, não de programação) e perde a alternativa que a versão anterior propunha de escrever uma taxonomia substituta do zero. Estimar 2–3 semanas de transcrição por instrumento antes de a Fase 2 poder ser aceita.

### 9.5 Anexos e documentação

- Categorias fixas (§7 `documents.category`) com validade quando aplicável (pedido médico, carteirinha, guia).
- Upload por câmera (recepção e terapeuta) com compressão no cliente.
- Visualizador inline; download registrado no audit log.
- Documentos marcados `shared_with_family` aparecem no portal.
- Retenção: prontuário eletrônico e anexos guardados por no mínimo 20 anos (Lei 13.787/2018); exclusão só por rotina de expurgo aprovada pelo gestor.

### 9.6 Painel de supervisão

Home do coordenador, sem menu:

- **Carteira:** pacientes ativos por terapeuta, ocupação de agenda por terapeuta (horas realizadas ÷ disponíveis, semana e mês), fila de espera até 1ª sessão.
- **Pendências clínicas:** evoluções atrasadas por terapeuta, planos sem aprovação, reavaliações vencendo, metas sem atualização há 30 dias.
- **Risco de evasão:** pacientes com 2+ faltas em 30 dias, sem confirmação D-1 recorrente, com guia vencida.
- **Qualidade:** % metas atingidas por terapeuta no trimestre, cancelamento pelo terapeuta, glosa atribuível.
- **Ações:** aprovar plano, validar meta atingida, reatribuir paciente, agendar supervisão com terapeuta (registro de supervisão vira evento auditável).

### 9.7 Portal da família

Mobile-first, login por OTP no telefone do responsável. Escopo v1:

- Agenda do filho (próximas sessões; confirmar/justificar falta; pedido de remarcação)
- Frequência do mês (sessões realizadas/faltas) — transparência reduz conflito na cobrança
- Metas do trimestre em linguagem para pais e status (em andamento / atingida)
- Orientações registradas pelo terapeuta na sessão (campo "orientação dada à família")
- Documentos liberados (relatórios, termos assinados) e envio de documentos (pedido médico novo, carteirinha)
- Questionário trimestral (NPS + perguntas sobre recepção e terapeuta) → alimenta métricas
- Mensagens via WhatsApp com template; portal mostra histórico

Não expõe: evolução bruta, dados de outros pacientes, valores de convênio, dados do terapeuta além do nome e conselho.

### 9.8 Faturamento e redução de glosa

Causas de glosa mapeadas → controle no sistema:

| Causa | Controle |
|---|---|
| Sessão sem guia/guia vencida | Bloqueio no agendamento (Fase 1) |
| Sessões acima do autorizado | `sessions_used` computado; bloqueio |
| Evolução ausente/atrasada | Só fatura sessão com evolução; alerta 24h |
| Relatório de evolução/reavaliação não entregue | Bloqueio de renovação sem relatório; job de prazo |
| Dados cadastrais divergentes (carteirinha, CID, conselho) | Validação de campos obrigatórios por convênio (`insurers.billing_rules`) |
| Profissional sem registro no conselho | `profiles.council_number` obrigatório para realizar sessão |
| Duplicidade | Constraint única (paciente, terapeuta, data, hora) |

Fluxo de competência: fechar → exportar → registrar envio → importar retorno → glosas atribuídas → recurso com prazo → recuperado. Cada etapa com data e autor.

### 9.9 Rastreabilidade

- `audit_log` em todas as tabelas clínicas e financeiras; consulta por paciente, por usuário, por período.
- Toda métrica tem "drill-down" até a lista de sessões/guias que a compõem.
- Exportação de prontuário completo por paciente (PDF) com histórico de versões, para auditoria de convênio ou conselho.
- Log de acesso a prontuário (quem abriu, quando) — exigência LGPD para dado sensível de menor.

### 9.10 Integrações

| Integração | Fase | Mecanismo |
|---|---|---|
| WhatsApp (Meta Cloud API ou Z-API) | 1 | Edge Function; templates aprovados; webhook para respostas |
| Faturista / sistema TISS | 1 | Exportação CSV/XLSX + importação de retorno; layout acordado |
| E-mail transacional | 1 | Resend ou similar |
| BI (Metabase/Looker Studio) | 3 | Conexão direta a views com usuário read-only |
| NFS-e | 3 | API do emissor |
| Google Calendar | 4 | Leitura para evitar conflito com agenda pessoal |
| TISS nativo | 4 | Só com decisão explícita |

### 9.11 Layout e operação

- Uma home por papel; nada de menu com 20 itens.
- Desktop para recepção/faturamento/supervisão; PWA mobile para terapeuta e família.
- Toque único para as ações de maior frequência: confirmar, falta, check-in, registrar tentativa, assinar evolução.
- Cores de status consistentes em todas as telas; tipografia legível a 1 m de distância na tela da recepção.
- Tempo de carregamento da agenda do dia < 1 s com 200 sessões.
- Acessibilidade mínima: contraste AA, foco visível, operável por teclado na recepção.

## 10. Métricas, metas e bonificação

Todas as métricas são views SQL sobre o schema do §7. Cada uma tem `metric_key`, escopo (clínica / profissional / convênio), período e drill-down. Metas iniciais são ranges de trabalho; recalibrar após 90 dias de dados reais.

### 10.1 Recepção (CLT → PLR semestral)

| metric_key | Definição (SQL em prosa) | Meta inicial | Peso |
|---|---|---|---|
| `first_response_min` | mediana(`first_contact_at` − `created_at`) em `patients` com status ≥ lead, horário comercial | ≤ 15 min | 10% |
| `lead_to_eval_rate` | avaliações agendadas ÷ leads do mês | ≥ 50% | 15% |
| `eval_show_rate` | avaliações `realizada` ÷ agendadas | ≥ 80% | 10% |
| `confirm_d1_rate` | appointments com `confirmed_at` até D-1 ÷ agendadas | ≥ 95% | 15% |
| `no_show_rate` | `falta_familia` ÷ agendadas | ≤ 8% | 20% |
| `recovery_rate` | faltas/cancelamentos com nova sessão `realizada` na mesma semana ÷ faltas | ≥ 40% | 15% |
| `intake_complete_rate` | pacientes novos com checklist de documentos completo antes da 1ª sessão ÷ novos | 100% | 10% |
| `no_auth_sessions` | sessões `realizada` sem `authorization_id` válido | 0 | 5% (eliminatório) |

### 10.2 Coordenação clínica (variável trimestral)

| metric_key | Definição | Meta | Peso |
|---|---|---|---|
| `occupancy_rate` | horas `realizada` ÷ horas disponíveis (agenda base do terapeuta) | ≥ 85% | 25% |
| `room_occupancy` | horas de sala usadas ÷ disponíveis | ≥ 75% | 10% |
| `queue_days` | mediana(dias entre avaliação realizada e 1ª sessão) | ≤ 14 | 15% |
| `churn_rate` | pacientes → `evadido` no mês ÷ ativos no início (exclui `alta`) | ≤ 3% | 20% |
| `clinic_cancel_rate` | `cancelada_clinica` + `cancelada_terapeuta` ÷ agendadas | ≤ 2% | 10% |
| `review_on_time` | reavaliações entregues ≤ `review_due_at` ÷ devidas | 100% | 10% |
| `auth_first_pass` | autorizações aprovadas sem reenvio ÷ enviadas | ≥ 85% | 10% |

### 10.3 Terapeutas PJ (progressão de faixa trimestral, não bônus)

| metric_key | Definição | Critério para subir de faixa |
|---|---|---|
| `note_24h_rate` | session_notes com `created_at_server` ≤ `ends_at` + 24h ÷ sessões realizadas | ≥ 98% |
| `data_collection_rate` | sessões com ≥ 1 `trial_data` ou metas marcadas ÷ realizadas (pacientes com programa ativo) | ≥ 95% |
| `therapist_cancel_rate` | `cancelada_terapeuta` < 24h ÷ agendadas | ≤ 2% |
| `report_on_time` | relatórios do terapeuta entregues no prazo ÷ devidos | 100% |
| `retention_90d` | pacientes do terapeuta ativos após 90 dias ÷ iniciados (exclui alta) | ≥ 90% |
| `goal_progress` | metas `atingida` validadas pelo supervisor ÷ metas ativas no trimestre | ≥ 60% |
| `family_nps` | NPS da pergunta sobre o terapeuta no questionário trimestral | ≥ 70 |
| `attributable_glosa` | glosas `attributable_to = terapeuta` ÷ guias do terapeuta | ≤ 1% |

Regra de produto: **nenhuma view usa sessões prescritas, horas indicadas ou tempo de permanência como numerador positivo para terapeuta.** Isso é teste automatizado.

Regra jurídica: a progressão de faixa é revisão de preço de serviço prevista em contrato, proposta pelo sistema e aprovada pelo gestor; o sistema não paga "bônus". O contrato PJ, o texto da tabela de faixas e o fluxo de aprovação passam por advogado trabalhista antes do primeiro contrato (Tema 1389 STF pendente).

### 10.4 Faturamento (CLT → PLR semestral)

| metric_key | Definição | Meta | Peso |
|---|---|---|---|
| `glosa_rate` | valor `glosado` ÷ faturado, por convênio | ≤ 4% | 35% |
| `glosa_recovery` | `recovered_amount` ÷ glosado | ≥ 50% | 20% |
| `batch_lead_days` | dias entre fim da competência e `exported_at` | ≤ 5 | 15% |
| `dso_days` | dias entre envio e pagamento, por convênio | ≤ 45 | 15% |
| `no_auth_sessions` | idem 10.1 | 0 | 15% (eliminatório) |

### 10.5 Gestor (sem bonificação; painel executivo)

`revenue_per_room_hour`, `cost_per_session`, `insurer_concentration` (maior convênio ÷ total, meta ≤ 40%), `active_patients`, `ltv_months` (permanência média), `payout_ratio` (repasse ÷ receita líquida), `ebitda_margin`.

### 10.6 Mecânica de cálculo

1. `pg_cron` roda no dia 1 de cada mês: calcula cada view para o período fechado e grava em `metric_snapshots`.
2. Tela de atingimento: por pessoa, realizado × meta × peso → % atingido. Métricas eliminatórias zeram o período se falharem.
3. PLR: soma semestral dos % mensais ponderados; memória de cálculo exportável (PDF) para o acordo de PLR.
4. Faixa PJ: no fim do trimestre o sistema gera "proposta de faixa" por terapeuta com evidência; gestor aprova ou rejeita; nova `therapist_contracts` com `valid_from`.
5. Toda métrica tem botão "ver sessões" que lista as linhas que a compuseram.

## 11. LGPD e segurança

- Dados de saúde de menores = dado pessoal sensível de titular vulnerável. Base legal: tutela da saúde (art. 11, II, f) + consentimento do responsável para portal, imagem e comunicação por WhatsApp. Termo de consentimento é documento obrigatório de entrada, versionado.
- RLS em 100% das tabelas; nenhuma query do cliente sem policy. Service role só em Edge Functions.
- Storage privado; URLs assinadas com expiração ≤ 15 min.
- Log de acesso a prontuário (leitura) além do audit log de escrita.
- Criptografia em repouso (padrão Supabase) e em trânsito; backup diário com PITR (plano Pro).
- Exclusão de dados: prontuário não se apaga a pedido (dever legal de guarda, 20 anos); dados de marketing/lead sim.
- Relatório de impacto (RIPD) simplificado antes da abertura; DPO nomeado (pode ser o gestor).
- Registro no conselho dos profissionais validado no cadastro; sessão só é `realizada` por profissional com `council_number` ativo.

## 12. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Sistema não pronto na abertura | Alta | Alto | Fase 0 com corte duro em 6 semanas; fallback em planilha + importador CSV |
| Uma pessoa construindo e comandando a ABM | Alta | Alto | Escopo de Fase 0/1 é o mínimo; sem feature nova até Fase 1 aceita; considerar dev freelancer para RLS e agenda |
| Faturista não aceita o layout exportado | Média | Alto | Acordar layout por escrito antes da Fase 1; testar com 10 guias reais |
| Terapeutas não registram evolução | Média | Alto | Formulário de 2 min; pendência visível para recepção e supervisor; critério de faixa |
| Reconhecimento de vínculo PJ | Média | Alto | Contrato revisado; sem exclusividade; terapeuta controla disponibilidade no sistema; progressão como preço de serviço |
| Digitização de VB-MAPP/ABLLS-R/ESDM no banco sem autorização por escrito da editora | Média | Médio-alto | Decisão de risco registrada pelo gestor (§9.4-A); acesso restrito por RLS; nunca exportado/distribuído fora da clínica; reversível pedindo licença por escrito a qualquer momento |
| Denver aplicado sem certificação | Baixa (mitigada) | Alto | Sistema bloqueia associar currículo Denver a terapeuta sem certificação registrada; clínica contrata terapeuta já certificado |
| Vazamento de dado de menor | Baixa | Muito alto | RLS, storage privado, log de leitura, teste de policy automatizado |
| WhatsApp API bloqueada/limitada | Média | Médio | Templates aprovados; fallback SMS; nunca depender do WhatsApp para registro clínico |
| Bonificação percebida como "meta de venda" | Média | Alto | Comunicação interna: metas são de processo e qualidade; nenhuma meta de terapeuta é volume |

## 13. Cronograma resumido

| Semana | Marco |
|---|---|
| 1–2 | Schema, Auth, RLS, audit log, cadastro contínuo |
| 3–4 | Agenda, sessão, status com motivo, anexos |
| 5–6 | Evolução rápida (PWA offline), home por papel, importador CSV — **aceite Fase 0** |
| 7–8 | Bloqueio por guia, fila de pendências, WhatsApp D-1 |
| 9–10 | Fechamento de competência, exportação ao faturista, importação de glosa |
| 11–12 | Repasse, testes com dados reais de 10 pacientes-piloto — **aceite Fase 1 / abertura** |
| Meses 4–6 | Plano por metas, transcrição e importação de VB-MAPP/ABLLS-R (`protocol_items`), taxonomia própria para as demais disciplinas, supervisão, portal família; contratação de terapeuta certificado ESDM em paralelo — Denver só ativa quando essa contratação fechar |
| Meses 7–9 | Views de métricas, metas, PLR, faixas, BI |
| Meses 10–12 | Grupo/escola, telessessão, TISS nativo (decisão) |

## 14. Backlog inicial (ordem de construção)

1. `supabase init`; migrations do §7; trigger de audit; policies por papel; testes de policy (pgTAP)
2. Tela de cadastro contínuo + fila de pendências (mesmo que a fila comece só com "cadastro incompleto")
3. Agenda semanal por sala/terapeuta com recorrência e bloqueio de conflito
4. Sessão: check-in, status, motivo, autor
5. Evolução estruturada + assinatura + versão + offline
6. Anexos com categoria e validade
7. Home por papel
8. Autorizações + trigger de bloqueio
9. WhatsApp D-1 + webhook
10. Fechamento de competência + exportação + importação de glosa
11. Repasse por faixa
12. (Fase 2+) conforme §8

## 15. Glossário

- **Guia / autorização:** documento da operadora que libera N sessões de um procedimento em um período.
- **Glosa:** recusa de pagamento de uma guia enviada; tem motivo e pode ter recurso.
- **TISS:** padrão ANS de troca de informação entre prestador e operadora.
- **Competência:** mês de referência do faturamento.
- **Repasse:** valor pago ao terapeuta PJ pelas sessões realizadas.
- **PLR:** participação nos lucros ou resultados (Lei 10.101/2000), não integra salário.
- **Faixa:** nível de valor-hora do terapeuta no contrato PJ.
- **Evolução:** registro clínico da sessão, assinado pelo profissional.
- **Reavaliação:** relatório periódico (3/6/12 meses) exigido para renovação de autorização.
- **VB-MAPP / ABLLS-R / Denver (ESDM):** instrumentos comerciais de avaliação e currículo em ABA/intervenção precoce, de editoras distintas (AVB Press, WPS, Guilford/Routledge), com direito autoral e, no caso do Denver, exigência de certificação. A clínica compra os três; os itens são transcritos para `protocol_items` sob decisão de risco registrada (§9.4-A), com acesso restrito por RLS. `domain_taxonomy` continua em uso para as disciplinas sem protocolo licenciado.

---

*Fontes do levantamento de mercado e base regulatória (set/2026): ComportaTUDO, Cliniconect, BlueSmiles, CollectABA; RN ANS 539/2022; STJ Tema 1.295 (mar/2026); STF Tema 1389 (pendente); Lei 13.787/2018; Lei 10.101/2000; LGPD art. 11.*
