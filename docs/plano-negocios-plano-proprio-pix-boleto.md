# Plano Próprio Faça Amigos: pacotes particulares por Pix Automático e boleto

Plano de negócios, riscos, cobrança automatizada, segurança, blindagem e marketing.

> **Como ler:** tudo marcado **PREMISSA** é estimativa de mercado e deve ser trocado por número real. Os pontos marcados **⚖️ ADVOGADO** ou **🧾 CONTADOR** precisam de validação profissional antes de entrar em produção. Este documento não é parecer jurídico.

---

## 0. Veredito

**Vale fazer**, mas não do jeito que costuma ser feito. A receita particular é a única linha da clínica sem glosa, sem guia e sem prazo de convênio, e por isso é a melhor margem e o melhor caixa. Ela só funciona se quatro condições forem cumpridas:

1. **É pacote de sessões, não plano de saúde.** O nome "Plano Próprio" é o maior risco jurídico do projeto (ver §2.1). A marca pode ficar, mas com a trava "pacote mensal de sessões, não é plano de saúde" em todo contrato e peça.
2. **O pagamento é antecipado.** A família paga o mês antes de usá-lo. Pós-pago no boleto é dar crédito sem análise a um público que, por definição, não tem cartão.
3. **O Pix Automático é o padrão, e o boleto é exceção.** Boleto depende da família lembrar de pagar todo mês. O Pix Automático não depende.
4. **Hoje o sistema não cobra sozinho.** Vender antes de automatizar (§6) vai gerar inadimplência invisível: ninguém percebe atraso porque nada marca "atrasado".

No cenário conservador, as particulares geram **cerca de R$ 96 mil brutos e R$ 17 mil de resultado em 12 meses**, depois de pagar mídia, e chegam a uma receita mensal recorrente (MRR) de **R$ 14,5 mil** no mês 12. O cenário de estresse fica perto do zero a zero (R$ 1,4 mil). Isso significa que o negócio não quebra, mas também não se sustenta se a inadimplência passar de 10%.

---

## 1. Produto e preço

### 1.1 Catálogo atual

Fonte: `chatbot-base-conhecimento.md:79`, tabela `insurer_price_tables`, códigos `PART-PLANO-*`.

| Pacote | Sessões/mês | Preço/mês | R$/sessão | Desconto vs avulso (R$ 190) |
|---|---:|---:|---:|---:|
| Encontro (avulso) | 1 | 190 | 190 | 0% |
| Primeiro Passo | 4 | 720 | 180 | 5% |
| **Laço** (âncora) | 8 | 1.400 | 175 | 8% |
| Vínculo | 12 | 1.990 | 166 | 13% |
| Turma | 16 | 2.580 | 161 | 15% |
| Abraço | 20 | 3.120 | 156 | 18% |
| Voo Livre | 24 | 3.640 | 152 | 20% |

### 1.2 Margem por pacote

Premissas desta tabela:
- **PREMISSA:** terapeuta PJ a R$ 80/sessão.
- **PREMISSA 🧾:** impostos de 14% sobre a receita.
- **PREMISSA:** taxa do meio de pagamento de cerca de R$ 2/fatura.
- Perda por inadimplência de 5%.

| Pacote | Receita | − Terapeuta | − Impostos | − Perda 5% | **Contribuição** | % |
|---|---:|---:|---:|---:|---:|---:|
| Primeiro Passo | 720 | 320 | 101 | 36 | **261** | 36% |
| Laço | 1.400 | 640 | 196 | 70 | **492** | 35% |
| Vínculo | 1.990 | 960 | 279 | 100 | **649** | 33% |
| Abraço | 3.120 | 1.600 | 437 | 156 | **925** | 30% |
| Voo Livre | 3.640 | 1.920 | 510 | 182 | **1.026** | 28% |

**Insight que contraria a intuição:** os pacotes grandes dão mais reais por família e **menos margem percentual**. Também concentram risco: uma família do Voo Livre inadimplente equivale a cinco do Primeiro Passo. A política de crédito (§3.3) precisa ficar mais rígida à medida que o pacote cresce, e não mais frouxa porque "é o cliente mais valioso".

### 1.3 Desconto por meio de pagamento

- **Pix Automático:** preço de tabela.
- **Boleto:** preço de tabela + R$ 0. Não cobrar "taxa de boleto" do consumidor, que é prática questionada pelo Procon.
- **Incentivo recomendado:** 3% de desconto no Pix Automático, embutido como "preço Pix" na comunicação.
  - No Laço, 3% são R$ 42/mês.
  - Paga-se se o Pix reduzir a perda em mais de 3 pontos percentuais em relação ao boleto, o que é realista: o débito automático elimina o esquecimento, que é a principal causa de atraso em boleto.
  - **Gate:** se a adesão ao Pix Automático passar de 70% sem desconto, removê-lo para novos contratos.

---

## 2. Os pontos fracos, antes de tudo

### 2.1 "Plano Próprio" × ANS (risco mais grave)

A Lei 9.656/98 define plano de saúde como prestação continuada de serviços **para cobrir custos de atendimento**, por preço pré ou pós-estabelecido. Uma clínica que vende "plano" com cara de cobertura pode ser vista como operadora sem registro, o que leva a autuação, multa e Procon.

**O que mantém o produto fora da definição:**
- quantidade **fixa** de sessões por mês, que o cliente sabe o que compra;
- nenhuma cobertura de evento futuro e incerto: não há "se precisar de X, está incluso";
- nenhum mutualismo: o preço de uma família não financia a outra;
- nenhuma carência, rede, reembolso ou "uso ilimitado".

**Regras de redação (contrato, site, posts, bot):**
- ✅ "Plano Próprio Faça Amigos: pacote mensal de 8 sessões".
- ✅ "Sessões terapêuticas com valor mensal fixo".
- ❌ "plano de saúde", "cobertura", "carência", "convênio próprio", "seu plano cobre", "atendimento ilimitado".
- O contrato deve trazer a cláusula: *"Este contrato é de prestação de serviços terapêuticos em quantidade determinada e não constitui plano privado de assistência à saúde nos termos da Lei 9.656/98."*

⚖️ **ADVOGADO:** validar o nome comercial "Plano Próprio". O plano B é "Programa Faça Amigos" ou "Pacote Faça Amigos".

### 2.2 Público sem cartão comprando pacotes de R$ 1.400 a R$ 3.640

Isso é um sinal de risco de crédito, não só uma preferência de meio de pagamento. A família sem cartão pode ser:
- bancarizada, mas sem limite (o caso mais comum, e quem tem limite estourado não deveria assumir R$ 3 mil/mês de compromisso);
- avessa a cartão (risco baixo);
- com nome restrito (risco alto).

O documento não recomenda recusar essas famílias. Recomenda **ajustar o pacote à capacidade de pagamento** e exigir pagamento antecipado (§3).

### 2.3 Ética clínica × cobrança

Suspender a terapia de uma criança com TEA por falta de pagamento é legal, mas uma interrupção abrupta pode ser questionada nos conselhos (CRP, CREFITO, CRFa) como abandono. Por isso, a régua (§6.3) prevê:
- aviso formal com antecedência;
- relatório de alta/transição e orientação de continuidade (rede pública/CAPSi, convênio);
- nunca usar a criança ou a sessão como instrumento de cobrança na frente dela ou de terceiros.

### 2.4 Vazamento de dado sensível no próprio boleto

Boleto e Pix trafegam por banco, app do pagador, extrato e DDA. Se a descrição disser "Terapia ABA – TEA", a clínica está expondo dado de saúde de menor (LGPD art. 11 e art. 14).

**Regra:** a descrição é sempre "Serviços de saúde – competência MM/AAAA – Instituto Faça Amigos". Na NFS-e, usar o código de serviço genérico; o diagnóstico nunca aparece.

### 2.5 O sistema hoje não sustenta a venda

Fonte: exploração do repositório.

| Achado | Onde | Consequência |
|---|---|---|
| Sem gateway; baixa manual | `app/gestor/contratos/actions.ts` (~linha 109) | Erro humano, conciliação lenta, fraude interna possível |
| `pix_code` e `boleto_url` existem e nunca são preenchidos | `contract_invoices` (`20260908050000_new_modules.sql`) | Família não recebe cobrança pelo sistema |
| `generate_package_invoices()` sem `cron.schedule` | `20261031234723_particular_package_billing.sql` | Fatura do mês só existe se alguém lembrar |
| Nada move fatura para `atrasado` | — | Inadimplência invisível |
| RLS só por clínica, não por papel | `patient_contracts` e `contract_invoices` | **Terapeuta lê valores e faturas de todas as famílias** |
| Colunas usadas sem migration (`billing_mode`, `invoice_day`, `unit_price`, `sessions_per_month`, `reference_month`, `description`) | `lib/database.types.ts` × migrations | Ambiente novo ou restore quebra a cobrança |
| View de faturamento ignora particular e lê `billing_batches` inexistente | `20260918_metabase_bi_views.sql` | Gestor não enxerga a receita particular |
| Template de cobrança removido | `20261104120000_remove_cobranca_template.sql` | Não há mensagem aprovada para a régua |

---

## 3. Modelo de cobrança conservador

### 3.1 Pré-pago

- **Competência = mês de uso.** A fatura de dezembro vence em **25 de novembro**.
- **1ª mensalidade:** paga **antes da primeira sessão**. Sem pagamento, a vaga não é reservada.
- **Mês de entrada no meio do mês:** cobrar proporcional às sessões restantes; pacote cheio a partir do mês seguinte.
- **Tolerância:** até D+5 a agenda segue normal. De D+6 em diante entra a régua (§6.3).

### 3.2 Faltas e reposição (o que mais gera briga)

| Situação | Regra |
|---|---|
| Família falta sem aviso | Sessão consumida, sem crédito |
| Família avisa com 24h ou mais | 1 reposição no mesmo mês, se houver horário. Limite de 2 por mês |
| Clínica ou terapeuta falta | Reposição obrigatória ou crédito na fatura seguinte |
| Sessões não usadas no fim do mês | Não acumulam (exceto falta da clínica) |
| Feriado | Previsto no calendário: o pacote é por mês, não por número de dias úteis. Comunicar na venda |

### 3.3 Política de crédito proporcional ao pacote

| Pacote | Exigência na entrada |
|---|---|
| Primeiro Passo e Laço | Cadastro + CPF do responsável financeiro + 1ª mensalidade antecipada |
| Vínculo e Turma | + consulta de crédito com consentimento (Serasa/Boa Vista via gateway) |
| Abraço e Voo Livre | + comprovante de renda **ou** Pix Automático obrigatório **ou** começar 2 meses no Vínculo |

Com nome restrito, não se recusa a família: oferece-se um pacote menor com Pix Automático. Isso preserva a criança e o caixa.

### 3.4 Encargos e reajuste

- **Multa de 2% e juros de 1% ao mês** (CDC art. 52 §1º). Nada acima disso.
- **Reajuste anual** por índice fixo no contrato (IPCA), com aviso de 30 dias.
- **Cancelamento:** aviso prévio de 30 dias e **sem multa de fidelidade**. Fidelidade em serviço de saúde infantil é cláusula de alto risco (CDC art. 51) e destrói a confiança na venda.

---

## 4. Cenários (12 meses a partir da abertura, dez/2026)

### 4.1 Premissas (PREMISSA, ajustar)

| | Estresse | Conservador | Base |
|---|---:|---:|---:|
| Famílias particulares no mês 12 (rampa linear) | 8 | 10 | 15 |
| % das ~100 crianças do ano 1 | 8% | 10% | 15% |
| Ticket médio | R$ 1.300 | R$ 1.450 | R$ 1.630 |
| Sessões/família/mês | 7,2 | 8,0 | 9,2 |
| Custo terapeuta/sessão | R$ 85 | R$ 80 | R$ 70 |
| Perda final por inadimplência | 10% | 5% | 3% |
| Adesão Pix Automático | 30% | 50% | 65% |
| Churn mensal | 8% | 6% | 4% |
| Mídia/marketing mensal | R$ 1.500 | R$ 1.500 | R$ 1.500 |

Fixos considerados: impostos de 14% 🧾, taxa de R$ 3 por boleto e de R$ 1,50 por Pix (verificar tabela atual do gateway). Os custos fixos da clínica (aluguel, recepção) **não** estão rateados aqui: o cálculo mede a contribuição incremental da linha particular.

### 4.2 Resultado

| R$ | Estresse | **Conservador** | Base |
|---|---:|---:|---:|
| Faturas no ano (famílias × mês) | 52 | 66 | 99 |
| Receita bruta | 67.600 | **95.700** | 161.370 |
| (−) Perda por inadimplência | 6.760 | 4.785 | 4.841 |
| (−) Impostos | 9.464 | 13.398 | 22.592 |
| (−) Terapeutas | 31.824 | 42.240 | 63.756 |
| (−) Taxas do meio de pagamento | 133 | 149 | 200 |
| **Margem de contribuição** | 19.419 (28,7%) | **35.129 (36,7%)** | 69.981 (43,4%) |
| (−) Marketing | 18.000 | 18.000 | 18.000 |
| **Resultado** | **1.419** | **17.129** | **51.981** |
| MRR no mês 12 | 10.400 | **14.500** | 24.450 |
| Contribuição/família/mês | 373 | 532 | 707 |
| LTV (contribuição ÷ churn) | 4.668 | 8.871 | 17.672 |
| **CAC máximo (LTV/3)** | 1.556 | **2.957** | 5.891 |

### 4.3 Leitura

- **A inadimplência pesa mais que o preço.** Do conservador para o estresse, a perda dobra (5% → 10%), o churn sobe e o resultado cai 92%. Cada ponto de inadimplência evitado vale mais que um ponto de desconto.
- **A taxa do gateway é irrelevante** (menos de R$ 200/ano). Não escolher gateway pelo menor preço por boleto; escolher por webhook confiável, régua nativa e Pix Automático.
- **Com mídia fixa de R$ 1.500/mês, o estresse só empata.** Se em 90 dias o CAC passar de R$ 1.500, cortar mídia paga e ficar com indicação e parcerias.

### 4.4 KPIs, todos com comparativo (regra do projeto)

| KPI | Comparativo obrigatório | Meta conservadora |
|---|---|---|
| MRR particular | vs mês anterior e vs meta | R$ 14,5 mil no mês 12 |
| Inadimplência > D+5 (% das faturas) | vs mês anterior e vs meta | ≤ 8% |
| Perda final > D+60 (% da receita) | vs meta | ≤ 5% |
| Adesão ao Pix Automático | vs mês anterior | ≥ 50% |
| Churn mensal | vs média de 3 meses | ≤ 6% |
| CAC | vs CAC máximo (LTV/3) | ≤ R$ 1.500 |
| Conversão avaliação → pacote | vs mês anterior | ≥ 35% |
| Aging (0–15 / 16–30 / 31–60 / >60) | vs mês anterior | > 60 dias: zero |

---

## 5. Matriz de riscos

Escala: P = probabilidade, I = impacto (1–5).

| # | Risco | P | I | Mitigação |
|---|---|:-:|:-:|---|
| 1 | Enquadramento como plano de saúde (ANS/Procon) | 2 | 5 | Regras de redação (§2.1), cláusula expressa, pacote fixo ⚖️ |
| 2 | Inadimplência acima de 10% | 3 | 4 | Pré-pago, Pix Automático, crédito por pacote, régua automática |
| 3 | Golpe do boleto falso via WhatsApp | 3 | 4 | Só número oficial verificado; 2ª via só no portal da família (OTP); conferir CNPJ do beneficiário em toda mensagem; preferir Pix Automático |
| 4 | Cobrança vexatória (CDC art. 42) | 2 | 4 | Templates aprovados; nunca cobrar na frente da criança, na recepção cheia ou em grupo |
| 5 | Negativação sem notificação (CDC art. 43 §2º; Súmula 359 STJ) | 2 | 4 | Notificação formal D+15 com prazo de 10 dias, feita pelo bureau/gateway |
| 6 | Cláusula abusiva (fidelidade, multa) | 2 | 3 | Sem fidelidade; aviso de 30 dias ⚖️ |
| 7 | Exposição de dado de saúde no boleto/NFS-e | 3 | 4 | Descrição genérica (§2.4) |
| 8 | Funcionário lê o financeiro de todas as famílias | **5 (ocorre hoje)** | 3 | RLS por papel (§7) |
| 9 | Baixa manual indevida ou desvio | 2 | 4 | Baixa só por webhook; baixa manual exige gestor + motivo + `audit_log` |
| 10 | Interrupção terapêutica questionada no conselho | 2 | 4 | Protocolo de transição (§2.3) |
| 11 | Fiscal: NFS-e emitida fora do mês ou sem emissão | 3 | 3 | Emissão automática na confirmação do pagamento 🧾 |
| 12 | Terapeuta PJ sai e leva famílias | 3 | 3 | Equipe de referência (≥ 2 terapeutas por criança); não-aliciamento no contrato PJ ⚖️ |
| 13 | Dependência de um único gateway | 2 | 3 | Abstração `PaymentProvider` no código; exportação mensal das faturas |

---

## 6. Automação de cobrança (especificação da fase 2)

### 6.1 Gateway: critérios, não marca

Requisitos mínimos: **Pix Automático** (jornada de autorização + cobrança recorrente), **boleto com QR Pix**, **webhook assinado**, **negativação/protesto integrados**, **NFS-e** (desejável), sandbox.

Candidatos a comparar (verificar preços e recursos atuais antes de escolher): Asaas, Efí (ex-Gerencianet), Banco Inter PJ, Cora, Pagar.me. Critério de desempate: confiabilidade do webhook e suporte a Pix Automático, não a tarifa (§4.3).

### 6.2 Arquitetura, reaproveitando o que já existe

```
pg_cron (dia 15) ──► generate_package_invoices()  [já existe; falta agendar]
        │                    │
        │                    ▼
        │         contract_invoices (pendente)
        │                    │  API route /api/billing/emit  (x-cron-secret, padrão 20260921040000)
        │                    ▼
        │         Gateway: cria cobrança Pix Automático ou boleto+QR
        │                    │  grava pix_code / boleto_url / gateway_id  [colunas já existem]
        ▼                    ▼
pg_cron diário ──► régua (Twilio Content templates, lib/twilio.ts + lib/whatsapp-window.ts)
                             │
Gateway ──webhook assinado──► /api/webhooks/billing
                             │  idempotente (gateway_event_id único)
                             ▼
               status = pago · NFS-e · audit_log · push ao gestor
pg_cron diário ──► pendente com vencimento < hoje ⇒ atrasado
```

- **Portal da família** (login OTP já existe): faturas, 2ª via, autorização do Pix Automático e recibos para IRPF e reembolso.
- **Abstração `PaymentProvider`:** interface `createCharge`, `createPixAutomaticMandate`, `cancel` e `parseWebhook`, para trocar de gateway sem reescrever o sistema.

### 6.3 Régua de cobrança

| Dia | Canal | Mensagem | Tom |
|---|---|---|---|
| D−5 | WhatsApp template + e-mail | Fatura disponível, valor e link do portal | Informativo |
| D−1 | WhatsApp (só boleto) | Lembrete de vencimento | Informativo |
| D0 | — | Pix Automático debita sozinho | — |
| D+1 | WhatsApp | "Não identificamos o pagamento"; link para 2ª via | Neutro |
| D+3 | WhatsApp + e-mail | Lembrete com multa e juros discriminados | Neutro |
| D+6 | Ligação humana (recepção/financeiro) | Entender o motivo e oferecer acordo | Acolhedor |
| D+10 | E-mail formal | Aviso: agenda do mês seguinte não será liberada sem regularização | Formal |
| D+15 | Notificação formal (bureau/gateway) | Aviso prévio de negativação, prazo de 10 dias | Formal |
| D+30 | — | Suspensão de **novos** agendamentos + relatório de transição clínica | Formal |
| D+30 a 45 | Gateway | Negativação ou protesto, só com aprovação do gestor | — |

Regras da régua:
- envio só entre 8h e 20h, de segunda a sábado;
- falha no Pix Automático (saldo insuficiente) cai automaticamente para boleto com QR;
- acordo de parcelamento gera nova fatura vinculada e pausa a régua.

---

## 7. Segurança

Pré-requisitos antes de ligar a cobrança automática:

1. **RLS por papel** em `patient_contracts`, `contract_invoices` e `patient_charges`: leitura para gestor, faturamento e recepção; escrita de status só para o service role (webhook) e para o gestor. **Terapeuta: nenhum acesso.**
2. **Migration de correção do drift:** criar oficialmente `billing_mode`, `invoice_day`, `unit_price`, `sessions_per_month`, `reference_month` e `description`, mais `gateway_id`, `gateway_event_id UNIQUE`, `paid_at`, `paid_amount` e `payment_method`.
3. **Webhook:** validar assinatura/HMAC e IP do gateway; usar idempotência por `gateway_event_id`; nunca confiar no valor vindo do cliente.
4. **Segredos:** chave do gateway só em variável de ambiente do servidor/Vault, nunca no client; token restrito (sem permissão de transferência/saque).
5. **Saque e transferência no gateway:** só pelo dono, com 2FA. Conta de saque fixa e alteração com carência.
6. **Baixa manual:** só gestor, com motivo obrigatório e `audit_log` (`fn_audit_log()` já existe).
7. **Segregação:** quem dá desconto ou acordo não é quem concilia.
8. **LGPD:** base legal "execução de contrato" para os dados financeiros, separada do consentimento de saúde; consentimento explícito para consulta de crédito; retenção fiscal de 5 anos para financeiro e 20 para prontuário.
9. **BI:** nova view `v_particular_receivables` com `security_invoker` (padrão `20261001012045`), alimentando o dashboard do gestor (§4.4).

---

## 8. Blindagem jurídica (checklist ⚖️)

- [ ] Contrato com **responsável financeiro** identificado (CPF), distinto do paciente.
- [ ] Assinatura eletrônica com trilha (IP, hora, e-mail/telefone). Validar com advogado a força executiva (CPC art. 784 e entendimento do STJ sobre contrato eletrônico sem testemunhas).
- [ ] Cláusula "não é plano de saúde" (§2.1).
- [ ] Quantidade de sessões, política de faltas e reposição (§3.2) **no corpo do contrato**, não só no site.
- [ ] Encargos (2% + 1% ao mês), índice de reajuste, aviso de cancelamento de 30 dias, sem fidelidade.
- [ ] Consentimento para consulta de crédito e para comunicação de cobrança por WhatsApp/e-mail.
- [ ] Cláusula de suspensão de novos agendamentos por inadimplência, com o protocolo de transição.
- [ ] Foro, LGPD e canal de atendimento.
- [ ] Contrato PJ dos terapeutas: confidencialidade e não-aliciamento.
- [ ] 🧾 Regime tributário e alíquota de ISS em Belém; emissão automática de NFS-e com CPF do responsável.

---

## 9. Marketing completo do Plano Próprio

### 9.1 Posicionamento

> **"Terapia com previsibilidade: a mesma equipe, no mesmo horário, todo mês, sem esperar autorização."**

O inimigo não são outras clínicas. É a **imprevisibilidade do convênio**: guia negada, fila, troca de terapeuta, sessão cortada no meio do tratamento. O Plano Próprio vende **continuidade**, que é o que mais pesa no resultado terapêutico infantil.

**Cuidado com a mensagem:** não falar mal de convênio. A clínica vive de convênio (§0). A mensagem é "você escolhe", não "convênio é ruim".

### 9.2 Públicos (personas)

| Persona | Dor | Pacote provável | Gancho |
|---|---|---|---|
| **A. Sem convênio** | Acha que terapia particular é inacessível | Primeiro Passo e Laço | "Comece com 4 sessões/mês, com valor fechado e no Pix" |
| **B. Convênio travado** | Autorização demora, sessões insuficientes | Laço e Vínculo (complementar) | "Complete o que o convênio não cobre" |
| **C. Reembolso** | Paga e pede reembolso; quer recibo certo | Vínculo+ | "NFS-e e relatório no padrão de reembolso" |
| **D. Alta intensidade (ABA)** | Precisa de 15–20h e o convênio não entrega | Abraço e Voo Livre | Avaliação + plano terapêutico + crédito (§3.3) |

### 9.3 Proposta de valor (o que entra em toda peça)

1. Valor mensal fechado, sem surpresa.
2. Equipe de referência fixa.
3. **Pix Automático:** "debita sozinho, você não precisa lembrar" (e 3% de desconto). Boleto para quem preferir.
4. **NFS-e no CPF do responsável:** despesa médica **dedutível integralmente no IR** (🧾 confirmar a redação). Esse é o argumento mais forte e menos usado pela concorrência.
5. Recibo e relatório para reembolso de convênio.
6. Cancelamento com 30 dias de aviso, **sem fidelidade**, o que reduz a objeção de compromisso.

### 9.4 Funil e jornada

```
Atração  ─► Instagram/Meta Ads Belém (raio de 8 km do Umarizal), Google Perfil da Empresa,
            indicação de pediatras/neuropediatras/escolas, grupos de mães atípicas
Captura  ─► WhatsApp oficial (bot já existe: lib/welcome-menu.ts, lib/twilio-faq-bot.ts)
            + lista de espera de fundadores
Qualif.  ─► perguntas do bot: idade, diagnóstico/suspeita, convênio, frequência indicada
Conversão─► avaliação (paga) ─► devolutiva com plano terapêutico + proposta de pacote
Fechamento► contrato eletrônico + autorização do Pix Automático (ou 1º boleto) no mesmo link
Retenção ─► relatório trimestral de evolução para a família, NPS (cron já existe),
            reunião semestral de plano
Indicação─► programa "Amigo Indica"
```

A regra de prevenção de duplicidade do projeto (AGENTS.md §3) vale aqui: um lead que já tem `patient_id` ou avaliação agendada não pode abrir um segundo funil.

### 9.5 Lançamento (pré-abertura em dezembro de 2026)

| Semana | Ação |
|---|---|
| S−6 | Landing page e lista de espera; posts de bastidores da obra/equipe |
| S−5 | Parcerias: visita a 15 pediatras/neuropediatras e 10 escolas com kit e cartão de indicação |
| S−4 | Abertura das **Vagas Fundadoras** (PREMISSA: 15 vagas, preço travado por 12 meses e avaliação com 50% de desconto) |
| S−3 | Live/encontro com a coordenação clínica: "Como escolher a frequência certa de terapia" |
| S−2 | Open house com agendamento de avaliações |
| S−1 | Lembretes para a lista de espera; fechamento das vagas fundadoras |
| S0 | Abertura; depoimentos só após consentimento formal |
| S+4 | Programa "Amigo Indica" ativo |

**Amigo Indica:** a família que indica ganha **1 sessão de crédito** quando a família indicada paga a 2ª mensalidade. Crédito em serviço, nunca em dinheiro. A 2ª mensalidade é o gatilho para evitar fraude e premiar só indicação que fica.

### 9.6 Peças e roteiros

**Post/carrossel ("Previsibilidade"):**
> 1/ Sessão autorizada hoje, negada amanhã? 2/ Terapia infantil funciona com constância. 3/ Plano Próprio Faça Amigos: pacote mensal de sessões, mesma equipe, mesmo horário. 4/ A partir de R$ 720/mês, no Pix Automático ou boleto. 5/ NFS-e no seu CPF para declarar no IR. 6/ *Pacote mensal de sessões. Não é plano de saúde.* Agende a avaliação pelo WhatsApp.

**Anúncio (Meta, até 125 caracteres):**
> Terapia infantil com valor mensal fixo e a mesma equipe todo mês. Pix Automático ou boleto. Agende a avaliação.

**Script de WhatsApp (pós-devolutiva):**
> "Oi, [nome]! Pela avaliação do [criança], a equipe indicou [N] sessões por mês. No Plano Próprio isso fica no **[Pacote]**, por **R$ [valor]/mês**. Você pode pagar no **Pix Automático**: autoriza uma vez, debita todo dia 25 e sai 3% mais barato. Se preferir, mandamos **boleto**. Não tem fidelidade: para cancelar, é só avisar com 30 dias. Te mando o contrato para assinar pelo celular?"

**Explicando o Pix Automático (objeção "isso é seguro?"):**
> "O Pix Automático é do Banco Central. Você autoriza no app do **seu** banco, vê o valor máximo e pode cancelar quando quiser, direto no banco. A gente não tem acesso à sua conta."

**FAQ de objeções:**

| Objeção | Resposta |
|---|---|
| "Está caro" | Mostrar o R$/sessão vs avulso; começar no Primeiro Passo; lembrar da dedução no IR |
| "Por que não pelo convênio?" | "Pode ser pelos dois. O Plano Próprio complementa o que o convênio não autoriza." |
| "E se ele faltar?" | Política clara de reposição com 24h de aviso (§3.2) |
| "E se eu quiser sair?" | Aviso de 30 dias, sem multa |
| "Recebi um boleto estranho" | "Só enviamos pelo número oficial, e o beneficiário é sempre o CNPJ do Instituto. Na dúvida, baixe no portal." |

**Restrições de publicidade (conselhos profissionais e LGPD):**
- sem promessa de resultado ("seu filho vai falar");
- sem antes/depois de criança;
- imagem de criança só com o consentimento já existente (`20260906000022_family_lgpd_consent.sql`) e, de preferência, sem rosto;
- sem preço "promocional" com prazo falso.

### 9.7 Orçamento e metas de marketing (conservador)

| Item | R$/mês (PREMISSA) |
|---|---:|
| Meta Ads (Belém, raio de 8 km) | 900 |
| Google Perfil + Ads de busca "terapia infantil Belém" | 400 |
| Material para parceiros (kits, cartões) | 200 |
| **Total** | **1.500** |

| Métrica | Meta | Comparativo |
|---|---|---|
| Custo por lead (WhatsApp) | ≤ R$ 25 | vs mês anterior |
| Lead → avaliação | ≥ 20% | vs meta |
| Avaliação → pacote | ≥ 35% | vs meta |
| CAC | ≤ R$ 1.500 (teto do estresse) | vs CAC máximo (§4.2) |
| % de vendas vindas de indicação | ≥ 30% no mês 6 | vs mês anterior |

**Regra de corte:** dois meses seguidos com CAC acima de R$ 1.500 ⇒ cortar a mídia paga pela metade e redirecionar para parcerias e indicação.

### 9.8 Calendário de 90 dias

| Mês | Foco | Conteúdo (3 posts/semana) | Ação |
|---|---|---|---|
| 1 | Lançamento | Bastidores, equipe, "como funciona o pacote", Pix Automático explicado | Vagas Fundadoras, open house |
| 2 | Educação | Frequência ideal de terapia, sinais de TEA/TDAH, IR e reembolso | Live com a coordenação; 1ª rodada de parceiros |
| 3 | Prova | Depoimentos consentidos de pais (sem a criança), rotina da clínica | Amigo Indica; revisão do CAC (gate) |

---

## 10. Roadmap com gates

| Fase | Prazo | Entregas | Gate para avançar |
|---|---|---|---|
| **0: Base** | Dias 0–30 | Revisão ⚖️ e 🧾; contrato; escolha do gateway; RLS por papel; migration do drift; agendar `generate_package_invoices` | Contrato aprovado; terapeuta sem acesso ao financeiro |
| **1: Cobrança** | Dias 30–60 | Integração com o gateway (Pix Automático + boleto+QR); webhook; cron de atraso; régua com templates aprovados; portal da família; dashboard | Teste ponta a ponta no sandbox; 0 baixa manual em 2 semanas de piloto |
| **2: Venda** | Dias 45–90 | Lançamento (§9.5) com até 15 famílias fundadoras | Inadimplência > D+5 ≤ 8%; adesão Pix ≥ 50% |
| **3: Escala** | Dia 90+ | Mídia paga contínua, pacotes grandes com política de crédito | CAC ≤ R$ 1.500; perda > D+60 ≤ 5% |

**Não vender antes do fim da fase 1, exceto as Vagas Fundadoras, cobradas manualmente e no máximo 15 contratos.**

---

## 11. O que ainda precisa de número real

- Custo/sessão real do contrato PJ por especialidade.
- Regime tributário e alíquota efetiva 🧾.
- Tarifas atuais dos gateways candidatos.
- Demanda real: tamanho da lista de espera, quantos leads do bot pediram valor particular (dado já disponível nas conversas Twilio).
- Capacidade ociosa de salas e horários: o particular deveria ocupar primeiro horários vazios de convênio, e não competir com eles.
