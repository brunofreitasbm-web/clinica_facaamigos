# Chatbot WhatsApp — auditoria da base de conhecimento e plano de otimização

Período analisado: 09/09/2026 a 21/10/2026 (banco `vththexblpxwocbowhsv`, projeto BD_CLINICA_RH).
Base auditada: `chatbot-base-conhecimento.md` (export de 21/10) = `clinic_faq` + convênios + tipos de
atendimento + tabela particular + horário da recepção + salas + equipe + prompt de `lib/twilio-faq-bot.ts`.

## 0. Resumo executivo

- O problema principal **não é o texto das respostas: é o que a base não cobre e o que o código faz quando
  não cobre.** Em 42 dias, 77 respostas foram o fallback genérico ("Boas-vindas… responda AGENDAR"), mas só
  20 chamadas ao Gemini falharam (503). Ou seja, ~57 fallbacks foram decisão do código (intent "emprego"
  descartado por regex, JSON sem `resposta`, etc.), não indisponibilidade da IA.
- A base **contradiz a si mesma e contradiz o site** em pelo menos 7 pontos (horário, guia, laudo, duração
  de sessão, currículo, "clínica em breve" vs. AGENDAR, convênios hardcoded). O modelo recebe as duas versões
  e escolhe uma ao acaso.
- **Candidatos a emprego são 1/3 do volume de outubro** (116 respostas `faq_emprego` + ~40 fallbacks) e o
  texto fixo manda para um link que vários não acham. Isso consome cota diária, polui a fila e gera ruído na
  Central.
- 2 bugs enviaram texto errado para famílias: o placeholder "⚠️ TODO: preencher telefone…" foi entregue a um
  lead em 20/10, e "valor da avaliação" recebe a resposta "Como começa o atendimento".
- O que a recepção respondeu manualmente (57 mensagens humanas) é a melhor fonte para novas entradas: adultos,
  Hapvida/reembolso, status de autorização IASEP, "ainda estamos montando agenda", primeira sessão com o
  supervisor, R$ 1.800 da avaliação neuropsicológica.

| Volume (42 dias) | Valor |
|---|---|
| Conversas | 262 (229 leads, 33 pacientes) |
| Mensagens de famílias | 1.469 |
| Respostas do bot | 1.294 |
| Respostas humanas | 57 (em 15 conversas) |
| Conversas sem nenhuma resposta humana | 239 de 262 |
| Fallback genérico (`atendimento_geral`) | 77 |
| Falhas Gemini (503) | 20 de 228 chamadas |
| Respostas pela camada de regras (sem IA) | 26 |
| Escalonamentos | 16 (9 pediu_humano, 7 fora_da_base) |
| Resposta "emprego" | 116 |

## 1. Contradições internas da base (o modelo recebe as duas versões)

| # | Tema | Versão A | Versão B | Decisão necessária |
|---|---|---|---|---|
| 1 | Horário de funcionamento | FAQ: seg–sex 8h–19h, sáb 8h–11h45 | `clinic_business_hours`: 8h–18h, sáb 8h–12h | Dono decide a grade; manter em **um** lugar (a tabela) e apagar o texto da FAQ |
| 2 | Guia autorizada | FAQ "guia para psicoterapia": "precisa estar validada ANTES… sem isso não liberamos horário" | Regra 12 do prompt + FAQ "encaminhamento": "guia NÃO é obrigatória, a clínica autoriza" | A recepção na prática pede documentos e **ela** solicita a autorização ao IASEP. Reescrever a FAQ de guia |
| 3 | Laudo | FAQ TEA: "laudo não é obrigatório" | FAQ encaminhamento + recepção: pelo convênio precisa de laudo/pedido médico com CID | Migration `20261006120000_clinic_faq_audit_fixes.sql` corrige isso, mas **não foi aplicada em produção** (a resposta antiga continua ativa) |
| 4 | Duração da sessão | FAQ: "todas 40 min, exceto Treino ABA 120" | `appointment_types` e tabela particular: Psicoterapia e Psicologia = 30 min; FAQ de grupo: 30 min | Tornar a FAQ derivada dos tipos de atendimento ou corrigir o texto |
| 5 | Lista de convênios | FAQ hardcoded "IASEP e PROASA" | Seção dinâmica de convênios (insurers) | Apagar os nomes do texto da FAQ; deixar só a seção dinâmica |
| 6 | Currículo | FAQ "Estão contratando?": "Estamos em busca de talentos… acesse o link Venha fazer parte do nosso time" | `JOB_INQUIRY_REPLY` + regra 13: "não recebemos currículos nem tratamos de vagas por aqui" | Unificar: uma mensagem, com o link **direto** `institutofacaamigos.com.br/trabalhe-conosco` |
| 7 | Terapias oferecidas | FAQ lista 5 (Fono, TO, Psicologia ABA, Psicoterapia, Neuropsicologia) | Tipos de atendimento e tabela de preços têm também Musicoterapia, Psicomotricidade, Psicopedagogia ABA, Treino ABA, Avaliação Neuropsicológica; o site lista Psicopedagogia | Lista única derivada de `appointment_types` |
| 8 | Telefone | FAQ ativa com "⚠️ TODO: preencher telefone" | Site: (91) 99178-2027 e institutofacaamigos@gmail.com | Preencher ou desativar **hoje** (foi enviado a uma família em 20/10 19:52) |
| 9 | "Portal da família" na política de faltas | FAQ manda justificar "pelo portal da família" | Leads não têm portal | Separar FAQ de lead e FAQ de paciente (ver §5) |

Contradição com o site público (institutofacaamigos.com.br), que é de onde vem a maioria dos leads:

- O site diz **"Clínica · Em breve"**, "A nossa Clínica ainda não abriu, mas você pode entrar na lista de
  espera" e "Entrar na lista de espera no WhatsApp". O bot nunca ouviu falar de lista de espera: quem clica
  nesse botão chega com "Olá! Quero entrar na lista de espera…" e recebe o fallback ou "responda AGENDAR".
  A recepção respondeu "ainda estamos em fase de montagem de agenda / início de outubro".
- O site promete "primeira conversa de acolhimento, sem formulário longo"; o fluxo AGENDAR pede CPF, nome,
  data de nascimento, laudo, certidão, carteirinha na sequência. Famílias abandonam no meio e voltam a
  perguntar ("Sobre o enviado, qual o próximo passo?", "Vocês analisaram a documentação?") sem resposta.
- O **Mapeamento Comportamental** (questionário gratuito do site) gera leads com a mensagem "Acabei de fazer o
  Mapeamento Comportamental do(a) X. Gostaria de conversar." e "Oi! Tenho uma dúvida sobre o Mapeamento
  Comportamental." — nada na base explica o que é, então vira escalonamento ou fallback.
- Site e página /trabalhe-conosco listam Fisioterapia, Psicopedagogia, Nutrição; a base do bot não diz se a
  clínica oferece fisioterapia (famílias perguntaram "fisioterapia pélvica pelo IASEP", "fisioterapia com
  psicomotricidade").

## 2. O que as famílias perguntaram e a base não responde

Contagem aproximada em mensagens de famílias (excluindo candidatos a emprego). Cada linha vira uma entrada
nova em `clinic_faq` ou uma regra no prompt.

| Pergunta recorrente | Vezes | Exemplo real | Resposta que a recepção deu (quando deu) |
|---|---|---|---|
| Terapia X é coberta pelo IASEP/PROASA? | 9 | "Tem fono pelo iasep?", "A Neuropsicologia atende o plano Iasep?", "integração sensorial pelo IASEP?" | — (nunca respondido) |
| Atendem adultos / qual faixa etária? | 5 | "Vcs aceitam adultos", "Mais aceita 19 anos", "Atendem crianças de 3 anos" | "Atendemos adultos também" |
| Como funciona (processo, do contato à 1ª sessão) | 8 | "Como funciona pra gente ter acesso às terapias", "Sobre o enviado, qual o próximo passo?" | "Recebemos a documentação, vamos solicitar autorização ao IASEP; assim que autorizadas marcamos a 1ª sessão, que é com o supervisor (avaliação inicial)" |
| Valor da avaliação (inicial / neuropsicológica) | 5 | "Qual o valor da avaliação?", "Valores de avaliação" | "Avaliação está custando R$ 1.800,00" (neuropsicológica, 7 anos) |
| Previsão de agenda / lista de espera | 7 | "Quero entrar na lista de espera", "Tem alguma previsão mais ou menos" | "Estamos montando agenda para outubro" |
| Plano não atendido (Unimed, Hapvida, Amazônia Saúde, SUS, "plano do hospital Belém") | 7 | "Vocês atender sus?", "Eu tenho Hapvida" | "Não atendemos Hapvida; seria particular; entregamos NF para reembolso" / "atendemos somente o PROASA NACIONAL" |
| Quais documentos para agendar pelo convênio | 4 | "Quais os documentos necessários?", "Qual documento? Pode ser encaminhamento?" | "laudo médico, carteirinha do convênio e RG do paciente" |
| Já tem autorização em outra clínica / quer migrar | 2 | "Se ela já tem autorização do IASEP por estar em outra clínica, como faço pra levar pra vocês?" | — |
| Intensidade: horas por dia / dias por semana / várias terapias no mesmo dia | 3 | "Quantas horas de terapias diárias e quantos dias?", "Teria como marcar os 4 no mesmo dia?" | — |
| Visita à clínica / conhecer antes | 3 | "Gostaria de fazer uma visita", "como posso agendar uma visita" | — |
| Terapias que a base não lista (psicopedagogia, fisioterapia, TCC, A.T., neuropsicopedagoga) | 6 | "fazem terapia cognitivo comportamental para 4 anos?", "Tem da neuropsicopedagoga" | — |
| Mapeamento Comportamental | 3 | "Tenho uma dúvida sobre o Mapeamento Comportamental" | "vamos passar seu contato para o time" |
| Laudo particular serve? / avaliação ou já segue o laudo? | 2 | "pode ser um laudo feito particular?", "Ele vai passar por avaliação ou já vai seguir o laudo?" | — |
| Reembolso: como funciona na prática | 2 | "Poderia me explicar melhor como funciona esse reembolso" | "entregamos a nota fiscal e você dá entrada na operadora" |
| Estacionamento / é no shopping? | 2 | "O endereço de vcs é no shopping?" | (o bot acertou: não é no shopping) |

## 3. Qualidade das respostas geradas (Gemini)

_(seção preenchida a partir da leitura integral das 197 respostas `faq_*` — ver §3.1 abaixo)_

## 4. Bugs de código que fazem a base parecer pior do que é

| # | Onde | Sintoma observado | Causa | Correção |
|---|---|---|---|---|
| B1 | `lib/faq-rules-pure.ts` regra 3 | "Valores de avaliação" / "valor da avaliação inicial" → resposta "Como começa o atendimento" (06/10, 20/10) | keyword `avaliacao` da FAQ 40 casa com qualquer frase que contenha a palavra; regra 3 não bloqueia tema de dinheiro | Aplicar `TOPICAL` (valores, agend…) também à regra 3 ou exigir que a keyword seja ≥ 2 palavras quando for genérica |
| B2 | `clinic_faq` + regra 3 | "⚠️ TODO: preencher telefone…" enviado à família (20/10 19:52) | FAQ ativa com placeholder; o filtro de placeholder existe só na UI | Regra: nunca enviar resposta que comece com "⚠️"/"TODO"; desativar a linha agora |
| B3 | `lib/twilio-faq-bot.ts` (intent emprego sem `hasExplicitJobSignal`) | "Vaga de fisioterapeuta", "vaga de atendente", "me candidatar", "professor de educação física" → fallback "Não consegui responder agora" (≈40 casos de 16 a 21/10) | o modelo classifica emprego, o regex não tem `atendente|fisioterap|educacao fisica|candidat|vaga(s)? (aberta|disponivel)` e descarta a resposta inteira | Ampliar `JOB_PATTERNS`/`STRONG_JOB_PATTERNS` com os termos reais do anúncio; quando descartar, **não** cair em fallback: pedir desambiguação em uma frase |
| B4 | `lib/greeting-pure.ts` | CTAs do site não reconhecidos: "Quero entrar na lista de espera…", "Acabei de fazer o Mapeamento Comportamental…", "Minha criança (X) tem menos de 4 anos…" | `SITE_PREFILL` só cobre um dos 4 textos do wa.me | Reconhecer os 4 prefills e responder cada um com texto fixo (sem IA) e intent próprio (`lead_lista_espera`, `lead_mapeamento`) |
| B5 | `lib/twilio.ts` + webhook | Duas respostas idênticas 2–3 s depois da mesma mensagem (17/09 15:09, 05/10 11:58, 21/10 17:38) | reentrega da Twilio antes do dedupe por `twilio_sid` concluir | Idempotência por `MessageSid` antes de processar, não só ao gravar |
| B6 | `loadFaqKnowledge` seção EQUIPE | Prompt lista "Estagiário…", "Funcionários…", "Prestadores… Grão Pará / Parque Shopping" e "Sala 5" duplicada | perfis genéricos e salas entram sem filtro | Remover equipe e salas do prompt (a família nunca perguntou; só dá material para invenção) |
| B7 | FAQ "Estão contratando?" | "Em busca de uma oportunidade" (17/10) → resposta da FAQ de contratação, conversa segue aberta | keyword `oportunidade` sozinha | Apagar a FAQ: emprego é tratado no código |
| B8 | Escalonamento | 239 de 262 conversas sem resposta humana; 12 pendentes há 6–10 dias; "Até agora ninguém me deu retorno" (16/10) | não é bug do bot, mas o bot promete "a equipe já foi avisada" | Ver §6 (KPI de tempo de resposta humana) |

## 5. Plano de otimização

### Fase 1 — hoje (zero código, só dados; 1 h)

1. Desativar ou preencher a FAQ "Qual o telefone para contato?" (telefone do site: (91) 99178-2027).
2. Aplicar em produção a migration `20261006120000_clinic_faq_audit_fixes.sql` (laudo TEA) — ela existe no
   repositório mas o banco não a tem.
3. Apagar a FAQ "Estão Contratando?" (duplica e contradiz o código).
4. Reescrever a FAQ "Preciso de guia autorizada…" para o que a recepção faz: "Pelo convênio precisamos de
   laudo/pedido médico com CID, carteirinha (frente e verso) e RG; **a clínica solicita a autorização** ao
   plano e avisa por aqui quando sair. A primeira sessão só é marcada depois da autorização."
5. Tirar "IASEP e PROASA" do texto da FAQ de convênios (a lista dinâmica já entra no prompt).
6. Decidir a grade de horário (18h ou 19h; 11h45 ou 12h) e deixar só em `clinic_business_hours`.
7. Mudar a saudação pós-FAQ "Quer que eu te explique alguma delas?" para uma pergunta que a base consiga
   responder ("Qual é o plano da criança e qual terapia você procura?").

### Fase 2 — novas entradas em `clinic_faq` (dono valida o conteúdo; 2 h)

Cada entrada com pergunta, 6–10 sinônimos reais (tirados das mensagens acima) e resposta curta:

| Categoria | Pergunta | Resposta sugerida (validar com a gestão) |
|---|---|---|
| regras | Qual a faixa etária atendida? | Crianças, adolescentes **e adultos** (confirmar: a recepção disse que atende adultos; a FAQ de grupo também cita adultos) |
| convenios | Quais terapias o IASEP/PROASA cobre? | Depende da autorização do plano por terapia; mandamos pedir com laudo e a clínica solicita. Hoje PROASA tem tabela para fono, psicologia, TO (inclusive ABA), nutrição e fisioterapia; IASEP: _(sem tabela cadastrada — preencher)_ |
| convenios | Não atendem meu plano (Unimed, Hapvida, Amazônia, SUS…). E agora? | Atendimento particular com nota fiscal para reembolso; não atendemos SUS |
| regras | Como funciona, do primeiro contato à primeira sessão? | 1) documentos por aqui; 2) clínica pede autorização ao plano (prazo do plano); 3) avisamos quando sair; 4) primeira sessão = avaliação inicial com o supervisor; 5) PTS |
| regras | Quais documentos preciso mandar? | Convênio: laudo ou pedido médico com CID, carteirinha frente e verso, RG/certidão da criança. Particular: nada |
| valores | Quanto custa a avaliação inicial / neuropsicológica? | Avaliação inicial (anamnese): _(definir)_. Avaliação neuropsicológica: R$ 1.800 (confirmar e cadastrar na tabela particular para o bot ler de lá) |
| horarios | Tem vaga? Qual a previsão de agenda / lista de espera? | Texto honesto sobre a fase atual (agenda em montagem / lista de espera) — hoje o bot promete "responda AGENDAR" e a recepção diz "sem agenda ainda" |
| regras | Já tem autorização em outra clínica, posso transferir? | _(decisão da gestão)_ |
| regras | Quantas sessões por semana? Dá para fazer várias no mesmo dia? | Definido no PTS após avaliação; a agenda tenta concentrar no mesmo turno quando a família mora longe _(confirmar)_ |
| local | Posso visitar a clínica antes? | _(decisão da gestão: sim com horário marcado / não)_ |
| terapias | Vocês têm psicopedagogia / fisioterapia / TCC / acompanhante terapêutico? | Psicopedagogia ABA: sim. Fisioterapia, TCC, A.T.: _(decisão)_ |
| outro | O que é o Mapeamento Comportamental? | Questionário gratuito e educativo do site, não é diagnóstico; quem fez recebe o retrato por e-mail e pode seguir para a avaliação inicial |
| local | Qual o telefone/e-mail? | (91) 99178-2027 · institutofacaamigos@gmail.com |
| valores | Como funciona o reembolso na prática? | Entregamos NF e relatório; a família dá entrada na operadora |

Entradas de paciente (não de lead) — política de faltas com "portal da família", remarcação, recibo —
devem ser marcadas com um campo novo `audience` (`lead` | `paciente` | `ambos`) e só entrar no prompt
conforme `twilio_conversations.kind`. Hoje um lead recebe instrução sobre portal que ele não tem.

### Fase 3 — código (1 PR; 1 dia)

1. **Emprego**: ampliar os padrões com os termos dos anúncios reais (`atendente`, `fisioterap*`,
   `educacao fisica`, `candidat*`, `vaga(s) (aberta|disponivel)`, `proposta de contratacao`); trocar o link
   genérico por `https://institutofacaamigos.com.br/trabalhe-conosco` e incluir o e-mail como alternativa
   (6 candidatos disseram que não acharam o link). Quando o modelo disser "emprego" e o regex discordar,
   perguntar "é vaga de trabalho ou horário para atendimento?" em vez de cair no fallback.
2. **Prefills do site**: reconhecer os 4 textos do wa.me e responder sem IA, cada um com a resposta
   adequada (lista de espera → coleta nome/plano/terapia e registra o lead; mapeamento → explica e oferece
   avaliação).
3. **Camada de regras**: bloquear tema de dinheiro/agenda na regra 3; nunca enviar resposta com "⚠️"/"TODO";
   regra 1 também para "procuro atendimento pelo IASEP" (sem verbo de cobertura).
4. **Prompt**: remover seções EQUIPE e SALAS; adicionar seção "SITUAÇÃO ATUAL DA AGENDA" editável em
   `chatbot_settings` (texto curto que o gestor atualiza: "agenda em montagem", "vagas para fono em novembro");
   regra explícita para plano fora da lista (responder particular + reembolso, não escalar).
5. **Dedupe** por `MessageSid` antes de processar.
6. **Fallback**: quando Gemini falhar, repetir a última pergunta aberta da família para a fila da recepção
   com `status='pending'` em vez de mandar boas-vindas de novo.

### Fase 4 — ciclo de aprendizado contínuo (área do gestor; 2 dias)

Hoje o painel Chatbot mostra contagens isoladas (conversas, mensagens hoje) — sem comparativo, o que
viola a diretriz de KPI do projeto. Proposta de view read-only `chatbot_kpis_semana` com:

| KPI | Comparativo |
|---|---|
| Taxa de resolução sem humano (conversas de lead concluídas pelo bot ÷ total) | vs. semana anterior |
| Taxa de fallback (`atendimento_geral` ÷ mensagens de família) | vs. semana anterior, meta < 3% |
| Perguntas sem resposta (mensagem de família com "?" sem resposta de bot/humano em 1 h) | vs. semana anterior |
| Tempo mediano até a 1ª resposta humana em conversas `pending` | vs. meta (horário comercial) |
| % de respostas pela camada de regras (custo zero) | vs. semana anterior |
| Falhas Gemini (503) ÷ chamadas | vs. semana anterior |

E uma aba "Perguntas sem resposta" na tela de FAQ (`/recepcao/atendimento` › Chatbot) listando, por
semana, as mensagens que caíram em fallback ou escalonamento `fora_da_base`, agrupadas por similaridade,
com botão "criar FAQ a partir desta pergunta". É isso que fecha o ciclo: a base passa a crescer a partir do
que as famílias realmente perguntam, não do que a equipe imagina.

## 6. O que não é problema da base (mas afeta a percepção dela)

- **Resposta humana**: 239 de 262 conversas nunca tiveram resposta de pessoa; 12 estão pendentes há 6–10
  dias. O bot diz "a equipe já foi avisada e responde em horário comercial". Sem SLA humano, melhorar a
  base só adia a frustração. KPI de tempo de resposta humana já existe (`business_minutes_between`); falta
  cobrar.
- **Site "Em breve" vs. bot "AGENDAR"**: decisão de negócio. Enquanto a agenda não abrir, o bot deveria
  operar em modo lista de espera (coletar e prometer retorno), não em modo agendamento.
- **Gemini**: 503 em 9% das chamadas e latência média de 10 s em algumas semanas (máximo 58 s). A camada de
  regras e os prefills sem IA reduzem a dependência; o resto é infra.

## 7. Perguntas para o dono do projeto (bloqueiam a Fase 2)

1. A clínica atende adultos? (recepção disse que sim; prompt diz "crianças e adolescentes")
2. Horário oficial: 18h ou 19h de segunda a sexta; 11h45 ou 12h no sábado?
3. Quais terapias o IASEP autoriza hoje? Existe fisioterapia, TCC, acompanhante terapêutico?
4. Valor da avaliação inicial (anamnese) no particular? Confirmar R$ 1.800 da neuropsicológica.
5. Agenda está aberta ou em lista de espera? Previsão?
6. Visita presencial antes de iniciar: permitida?
7. Candidatos: manter "não recebemos currículo por aqui" ou aceitar PDF no WhatsApp e encaminhar ao RH
   (vários anúncios aparentemente disseram que podia ser pelo WhatsApp)?
