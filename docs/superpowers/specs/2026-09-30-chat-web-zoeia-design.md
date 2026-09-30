# Chat próprio (web) para o chatbot da clínica — plano

## Contexto

Hoje toda a conversa com famílias e leads acontece no WhatsApp via Twilio. O "brain"
(FAQ com Gemini, agendamento de anamnese, faltas, acolhimento de convênio, ingestão de
documentos) vive em `lib/twilio.ts:handleTwilioIncomingMessage` (L519-807) e é
**agnóstico de transporte**: recebe `{from, body, media}` e devolve
`{replyMessage, intent, concluded}`. O que é específico do WhatsApp fica nas bordas:
o webhook (`app/api/webhooks/twilio/route.ts`), o envio (`sendTwilioWhatsApp`) e o
vocabulário do prompt. O painel de teste (`app/actions/twilio-chatbot.ts`) já chama o
pipeline sem Twilio.

### Decisões do dono (entrevista de 30/09/2026)
- **Objetivo: experiência com a marca FaçaAmigos** (anexos, botões, sem janela de 24h
  nem aprovação Meta por resposta). Twilio **diminui**, não some.
- **Sem SMS, nunca.** Link só por WhatsApp (resposta na janela de serviço ou template
  utility), e-mail Brevo, portal da família e QR.
- **Gemini continua sendo a IA** dentro do chat, com o mesmo conhecimento (`clinic_faq`,
  convênios, preços particular, horários).
- **Persona única do hub: ZoeIA** (nome e avatar já usados no playground,
  `apps/kiosk-ui/src/lib/geminiAgent.ts:241`). O prompt da clínica passa a se apresentar
  como ZoeIA.
- **Identidade:** link assinado entregue ao telefone (prova de posse, sem código
  digitado) + **aceite LGPD no início** + **verificação (CPF do responsável + nascimento
  da criança) antes de qualquer dado pessoal ou histórico**.
- **Família com mais de uma criança:** o chat pergunta "sobre qual criança?" com botões.
- **Aviso de resposta humana:** web push do PWA; quem não aceitou push recebe 1 template
  WhatsApp com o link quando há resposta parada.
- **Entrada do lead:** site → `wa.me` → o bot responde com o link do chat (mensagem de
  serviço na janela de 24h: sem template, sem custo Meta até 1.000/mês).
- **Regra de canal (decisão final):** *quem vem até a clínica* (lead da landing, QR,
  família escrevendo espontaneamente) é direcionado ao **chat web**; *quando a clínica
  precisa de uma resposta da pessoa* (confirmação D-1, falta/remarcação, pré-anamnese,
  acolhimento de convênio, NPS, reunião, devolutiva, e no playground renovação/NPS/
  relatório de sessão) o disparo e a resposta ficam no **WhatsApp**, como hoje. Nenhum
  disparo migra para o chat. O link do chat só aparece num disparo como atalho opcional
  para anexar documentos (Fase 2, flag), nunca como canal de resposta.
- **Áudio:** Fase 2. **Escopo v1: só clínica.** Playground na Fase 3.
- Canais de link sem custo Twilio: botão "Conversar" no Portal da Família, e-mail Brevo
  (quem tem `guardians.email`), QR genérico na recepção e no site.

### Premissas técnicas que sustentam o plano
- **Telefone E.164 continua sendo a chave** de `twilio_conversations.phone_number` e
  `chatbot_sessions.phone_number`. O chat web injeta o telefone que veio no link.
  Nenhum bot é reescrito.
- Aviso LGPD é obrigação legal e transparência; **quem impede acesso cruzado é o link
  de posse + a verificação**. As duas coisas entram, com papéis distintos.
- O app da clínica **não tem push hoje** (nenhum service worker, nenhuma tabela de
  assinaturas): é infra nova, pequena, copiando o padrão `fa_kiosk_push_subscriptions`
  do playground.

## Riscos que o desenho carrega

| Risco | Mitigação |
|---|---|
| Estranho digitando o telefone de uma família cairia no thread dela (`findOrCreateConversation` reusa por telefone) | Nenhuma conversa web nasce de telefone digitado. Só de link entregue ao número (WhatsApp/e-mail/portal). QR genérico abre chat de lead com chave sintética `web:<uuid>`, sem vínculo a paciente. |
| CPF + nascimento é segredo fraco; `guardians.cpf` é nullable | É segundo fator, não identidade. Sem verificação, o chat mostra só mensagens posteriores ao link e não liga fluxos que exponham agenda/prontuário. 3 tentativas por link, bloqueio 1h, nota interna na Central. CPF nulo → nome completo do responsável + nascimento. |
| Realtime do Supabase não chega a anônimo (RLS em `messages`) | Página pública faz polling em rota validada por cookie (2,5s visível / 15s oculta / logo após POST). Inbox continua em Realtime. |
| Gemini sem timeout; na web a pessoa fica no spinner | `AbortSignal.timeout(25s)` no FAQ (cai no fallback estático existente); rota com `maxDuration = 60`; indicador "ZoeIA digitando". |
| Modo `link_only` com família no meio de um fluxo WhatsApp | Gate só age se `chatbot_sessions.current_step='idle'`; senão processa no WhatsApp e anexa o link. `hasRecentOutbound` ignora `intent='link_entrega'` (senão a saudação some por 6h). |
| Cota Gemini 20/dia por telefone estoura numa sessão web | `chatbot_settings.daily_reply_limit_web` (default 60), lida em `reserveDailyQuota` por canal. |
| Nota interna do supervisor (`channel='portal'`) vaza pro chat | GET público filtra `channel in ('whatsapp','web')`. |
| Link encaminhado | Token troca por cookie httpOnly HMAC (`ch_s`, padrão `ck_s` do check-in) e a URL fica limpa; o link vale 7 dias e pode ser reaberto (continuidade em outro aparelho), mas histórico e documentos só aparecem após CPF + nascimento; novo link revoga o anterior; cookie 30 dias. |
| Push no iPhone exige instalar na tela inicial | Banner "adicionar à tela inicial" no chat; fallback por template WhatsApp cobre quem não instalou. |
| `chatbot_sessions` com RLS `using (true)` | Restringir a papéis de equipe na mesma migration (só service role escreve). |
| Resposta a um disparo (ex.: "1" para confirmar D-1, horário da remarcação, PDF pedido pela pré-anamnese) chega pelo WhatsApp com `link_only` ligado e seria redirecionada ao chat | O gate `link_only` só age com `chatbot_sessions.current_step='idle'` **e** sem disparo pendente para o telefone nas últimas 72 h (`messages` outbound com `template_key`); qualquer resposta a fluxo iniciado pela clínica é processada no WhatsApp, sem link. Teste unitário cobre a matriz. |

## Fluxo do desconhecido vindo da landing (caso mais comum)

1. Landing → botão "Falar com a ZoeIA" → abre `/chat` **direto, sem formulário**.
   O servidor cria a conversa de lead com chave sintética `web:<uuid>` (nada de
   telefone ainda), grava o cookie e já renderiza a boas-vindas da ZoeIA em HTML.
2. Primeira tela = aceite LGPD curto (1 toque) + boas-vindas + **chips de pergunta**
   vindos do conhecimento (ver seção seguinte): "Agendar avaliação", "Quais planos
   aceitam?", "Valores particular", "Terapias", "Endereço e horário", "Falar com a
   recepção". A pessoa também pode digitar livre.
3. Chip de FAQ envia o **texto exato da pergunta cadastrada** em `clinic_faq`; a camada
   de regras (`matchFaqRule`, `lib/faq-rules-pure.ts`) responde do banco **sem Gemini**,
   em menos de 300 ms. Só texto livre ambíguo cai na IA.
4. Depois de cada resposta, chips de continuação: perguntas da mesma `category` de
   `clinic_faq` (sem IA) + "Agendar avaliação" sempre visível.
5. "Agendar avaliação" entra na máquina de anamnese existente. Como não há telefone, o
   **primeiro passo passa a ser "Qual seu WhatsApp?"** (validação E.164, gravado em
   `collected_data.guardian_phone` e em `twilio_conversations.contact_phone`);
   `finalizeAnamnesisRequest` usa `collected.guardian_phone ?? phone`
   (`lib/twilio-anamnesis-bot.ts:244` hoje usa só `phone`). O número digitado **não**
   liga a conversa a nenhum thread existente — só serve para a clínica retornar.
6. Documentos (laudo, carteirinha) sobem pelo botão de anexo; entram em
   `registration_drafts` como hoje (extração por IA em segundo plano).
7. "Falar com a recepção" ou escalada do bot → conversa vira `pending` na Central.
   Se a pessoa fechar a aba, a cutucada vai por push; sem push, template WhatsApp para o
   `contact_phone` informado (risco aceito: se o número for de outra pessoa, ela recebe
   um link que só mostra o que o próprio desconhecido escreveu).
8. Quando essa pessoa depois escreve pelo WhatsApp real, nasce um thread por telefone;
   a Central ganha "mesclar com conversa web" (Fase 2). Até lá, o `contact_phone` na
   ficha do lead permite a recepção reconhecer.

Proteção contra abuso do chat aberto: cookie obrigatório emitido pela página; honeypot;
máximo 5 conversas novas por hora por `hashIp`; cota diária de IA por conversa
(`daily_reply_limit_web`); camada de regras antes da IA; corpo ≤ 2k; Vercel Firewall
em modo desafio se houver pico.

## Botões a partir do conhecimento (sem IA quando der)

- `clinic_faq` ganha `show_as_button boolean default false` e `button_label text`
  (rótulo curto para o chip; a `question` completa é o que é enviado). A aba Chatbot >
  FAQ ganha o toggle "mostrar como botão" e ordem (`sort_order` já existe).
- Chips fixos de ação (não são FAQ): "Agendar avaliação" (dispara o gatilho `agendar`
  da anamnese), "Falar com a recepção" (escalada `pediu_humano`), "Enviar documento"
  (abre o anexo).
- Continuação após resposta: `relatedFaqChips(category, exclude)` em
  `lib/chat-reply-pure.ts` (puro, do cache de conhecimento já carregado); o campo
  `sugestoes` do Gemini só complementa quando a resposta veio da IA.
- Garantia de acerto sem IA: o chip envia `question` literal e `matchFaqRule` já casa
  pergunta cadastrada + `keywords`; teste unitário cobre "todo chip cadastrado é
  respondido pela camada de regras".

## Performance em Android de entrada (Xiaomi/Motorola, 3G/4G fraco)

Orçamento e regras, verificados no `next build` e em Lighthouse mobile com CPU 4x mais
lenta e rede "Slow 4G":
- JS do route `/chat/c` ≤ 80 KB gzip; sem `lucide-react`, `react-window`, `@react-pdf`
  ou qualquer lib do restante do app (ícones em SVG inline). Componente cliente só para
  input, polling e botões; boas-vindas, chips e histórico vêm renderizados do servidor.
- Fontes: só Fredoka no cabeçalho (subset latin, `display: swap`), corpo em fonte do
  sistema. Nenhuma imagem além do logo SVG.
- Aquecimento: o GET de `/chat/c` já chama `loadFaqKnowledge` (cache de 5 min) para a
  primeira resposta não pagar a leitura de 7 tabelas.
- Resposta imediata: chips → regras (sem IA); IA só para texto livre; indicador
  "ZoeIA digitando" aparece no clique; timeout de 25 s com fallback estático.
- Rede: POST devolve a resposta do bot na mesma chamada; polling leve (`?since=`,
  JSON mínimo, 2,5 s visível / 15 s oculta); service worker faz precache do shell
  (segunda abertura instantânea, mesmo offline mostra o histórico em cache).
- Toque: alvos ≥ 44 px; `font-size: 16px` nos inputs (evita zoom); layout em flex com
  container rolável (sem `position: fixed` no rodapé, que quebra com teclado em Chrome
  antigo); `100dvh` com fallback `100vh`; sem `:has()` nem container queries.
- Compatibilidade: conferir `browserslist` do Next 16 contra Chrome/WebView ≥ 100
  (Android 9/10 típico dessas linhas); se preciso, `browserslist` explícito no
  `package.json` para o build transpilar.
- Métrica de aceite: LCP < 2,5 s e INP < 200 ms no perfil acima; primeira resposta de
  chip < 500 ms no servidor (medido em `ai_usage_log`/log da rota).

## Continuidade: sair da tela e voltar de onde parou

O que já garante continuidade sem código novo: toda mensagem é gravada no servidor
**antes** de o bot rodar (passo 0 do pipeline) e o estado de fluxo vive em
`chatbot_sessions.current_step/collected_data` por chave, não no navegador. Nada se
perde ao fechar a aba. O que falta é o caminho de volta, por cenário:

| Cenário | Mitigação |
|---|---|
| Fechou a aba / trocou de app, mesmo aparelho | Cookie httpOnly de 30 dias → `/chat/c` reabre com histórico completo renderizado no servidor. Se `current_step != idle`, a ZoeIA abre com bolha de retomada: "Você estava enviando a carteirinha. Continuar de onde parou / Recomeçar" (`resumePromptForStep(step)` em `lib/chat-reply-pure.ts`, um texto por passo). Texto não enviado fica em `localStorage` (`src/hooks/useDraftMessage.ts` já existe). |
| Instalou como PWA | Ícone na tela inicial abre direto em `/chat/c`; service worker serve o shell e o último histórico do cache mesmo sem rede, e sincroniza ao voltar. Banner "adicionar à tela inicial" aparece uma vez, depois da primeira resposta. |
| Perdeu o cookie (limpou dados) ou abriu em outro aparelho, **paciente** | O mesmo link continua válido por 7 dias e pode ser aberto mais de uma vez (muda a regra de "uso único": o token só é revogado quando um novo é emitido). Depois disso, novo link pelo Portal da Família, e-mail Brevo ou WhatsApp (recepção ou template). Verificação por CPF + nascimento protege o histórico em qualquer aparelho. |
| Perdeu o cookie, **lead** (chave sintética, sem link) | Assim que o fluxo coleta e-mail ou WhatsApp (anamnese pede os dois), a ZoeIA oferece "quer receber o link deste chat para continuar depois ou em outro celular?" → e-mail (grátis) ou template WhatsApp (flag). Sem contato informado não há como recuperar; a tela avisa isso de forma discreta antes de um fluxo longo. |
| Abandonou um fluxo no meio (anamnese, documentos) | Varredura a cada 30 min (padrão de `lib/insurance-intake-stale.ts`, pg_cron): sessão web com `current_step` de coleta parada há > 30 min → push "Faltam 2 passos para concluir"; sem push e com telefone conhecido → 1 template WhatsApp após 24 h (flag, máx. 1 por fluxo). A Central mostra "parou no passo X há 40 min" na ficha do lead (`chatbot_sessions.updated_at`) com botão "Enviar link". |
| Resposta humana chegou com a pessoa fora | Push; sem push, template com link (já na seção de Central). |
| Rede caiu no meio do envio | POST idempotente por `client_message_id`; o cliente repete até confirmar; a bolha fica "enviando…" e nunca some. |

Migration (adendo): `chat_access_tokens.revoked_at` passa a ser setado só por nova
emissão; `chatbot_sessions.channel text` para a varredura distinguir sessões web.

## Tela: limpa, sem poluição, sensação de fluidez e rapidez

Regras de UI do chat (deliberadamente diferentes do resto do sistema, cujo `DESIGN.md`
usa cards com sombra em tudo):
- **Uma coluna, três zonas**: cabeçalho de 48 px (avatar ZoeIA + nome + estado
  "online"/"digitando"), área de mensagens, barra de entrada. Nada mais: sem menu, sem
  sidebar, sem rodapé, sem banner permanente.
- **Uma cor de destaque** (rosa da marca) só em ação primária e no avatar; fundo
  `--color-chat-bg` liso; bolhas sem sombra, raio 18 px, ZoeIA à esquerda em branco,
  pessoa à direita em rosa-claro. Sem ícones decorativos, sem emojis fora do texto do
  bot.
- **Chips em uma linha rolável horizontal**, no máximo 5 visíveis, somem ao começar a
  digitar e voltam após a resposta. Ações fixas viram um único botão "+" ao lado do
  input (anexar, falar com recepção), nunca uma barra de botões.
- **Zero interrupção**: aceite LGPD é uma bolha da ZoeIA com botão "Aceitar e
  continuar" no fluxo, não um modal. Pedido de push só aparece depois da primeira
  escalada para humano, uma vez. Verificação e escolha de criança também são bolhas
  com botões. Sem overlays, sem toasts empilhados.
- **Percepção de velocidade**: bolha da pessoa aparece na hora (otimista), três pontos
  da ZoeIA em até 100 ms, resposta de chip em menos de meio segundo; transições de
  150 ms só em opacidade/transform; rolagem suave apenas na chegada de mensagem.
  Nada de skeleton na primeira tela: o HTML já vem pronto do servidor.
- **Menos texto na tela**: sem carimbo de hora em cada bolha (agrupado por bloco,
  "hoje 14:32" discreto); status de entrega só na última mensagem da pessoa; nomes de
  arquivo em pill curta com ícone SVG.
- **Teclado**: input cresce até 4 linhas, botão enviar só ativa com texto; foco
  automático depois de tocar chip; nada se move quando o teclado abre além da área de
  mensagens.
- Referências de ritmo: WhatsApp e iMessage (a família já sabe usar), sem copiar a
  identidade visual deles.

## Fase 1 — MVP

Entrega: lead e família conversam em `/chat/c` com ZoeIA (FAQ, agendamento de anamnese,
upload de documento, botões), aceite LGPD, verificação, seleção de criança; WhatsApp
responde com o link; Central enxerga o canal.

### Migration `supabase/migrations/<ts>_web_chat_channel.sql`
1. `messages`: `channel` CHECK vira `('whatsapp','portal','web')`; `client_message_id text`
   com índice único parcial (dedupe igual a `idx_messages_twilio_sid`); `payload jsonb`
   (opções renderizáveis).
2. `twilio_conversations.last_channel text not null default 'whatsapp'` CHECK
   `('whatsapp','web')`; `phone_number` passa a aceitar chave sintética `web:<uuid>`
   (só formato; continua NOT NULL).
3. `chatbot_settings`: `whatsapp_mode` (`'full'|'link_only'`, default `'full'`),
   `daily_reply_limit_web int default 60`, `nudge_template_enabled boolean default false`.
4. Nova `chat_access_tokens`: `token_hash` (sha256, unique), `conversation_id` FK,
   `phone`, `kind ('lead'|'patient')`, `patient_id` (escolhido no multi-filho), `flow`,
   `delivery ('whatsapp'|'email'|'portal'|'qr')`, `created_by`, `expires_at`,
   `revoked_at`, `lgpd_accepted_at`, `lgpd_version`, `verified_at`, `verify_attempts`,
   `locked_at`, `last_seen_at`, `ip_hash`. RLS: leitura só equipe; escrita só service role.
5. Nova `chat_push_subscriptions` (`token_id` FK, `endpoint` unique, `p256dh`, `auth`,
   `created_at`, `last_error`). RLS: sem acesso de cliente (só service role).
6. `fn_conversation_last_sender` (migration 20260929000000): guard aceita `web`; ao
   inbound em `('whatsapp','web')` grava `last_channel`.
7. `chatbot_sessions`: substituir `chatbot_sessions_admin` por
   `app_current_role() in ('gestor','supervisor','recepcao')`.
8. Regenerar `lib/database.types.ts`.

### Módulos puros (novos, testáveis com `node --test`, sem imports `@/`)
- `lib/chat-reply-pure.ts`: `ChatChannel`, `ChatOption = {label, send}`,
  `BotReply = {replyMessage, options?}`, `optionsForYesNo()`, `optionsForSlots(n)`,
  `optionsForChildren(patients)`, `shouldSendLinkOnWhatsapp({mode, currentStep,
  lastLinkSentAt, now})`, `linkReplyText(url)`, `isSyntheticWebKey(phone)`.
- `lib/whatsapp-markdown-pure.ts`: `parseWhatsappMarkdown(text)` → tokens
  (negrito/itálico/tachado/mono/url). Hoje `ChatBubble.renderFormattedBody` só linkifica
  URLs e mostra `*asteriscos*` literais; a Central ganha junto.
- `lib/chat-access-pure.ts`: `hashChatToken`, `isChatTokenFormat`, assinatura e
  verificação do cookie (espelha `issueFormToken/verifyFormToken` de
  `lib/checkin-security.ts`; env `CHAT_HMAC_SECRET`), `visibleMessageFilter({verified,
  tokenCreatedAt})`, `matchIdentity({cpfDigits|guardianName, birthDate}, guardian, patient)`.

### Servidor
- `lib/chat-access.ts` (`server-only`): `issueChatLink({phone|synthetic, kind, flow,
  patientId?, delivery, createdBy})` (usa `findOrCreateConversation` + insere token),
  `resolveChatToken` (padrão `resolveIntakeToken`, `lib/patient-intake-form.ts:26-61`),
  `resolveChatCookie`, `touchLastSeen`, `listPatientsForPhone` (todas as linhas de
  `guardians` que casam, via `normalizeBrLocalPhone`).
- `lib/chat-reply.ts`: `deliverBotReply({conversation, channel, reply, intent, concluded})`
  — mover o bloco `app/api/webhooks/twilio/route.ts:133-193`. `whatsapp` →
  `sendTwilioWhatsApp` + insert; `web` → só insert (`channel='web'`, `payload.options`).
- `lib/chat-nudge.ts`: `nudgeStaleWebSession(conversationId)` chamado por
  `sendManualMessage` quando `last_channel='web'` e `last_seen_at` > 5 min: tenta web
  push (`web-push`, VAPID em env); sem assinatura ou falha → 1 template utility
  `TWILIO_CHAT_NUDGE_TEMPLATE_CONTENT_SID` com o link, no máximo 1 por 24h por conversa.
- `lib/chat-email.ts`: `sendChatLinkEmail(guardian, url)` via `sendEmail` de `lib/email.ts`
  (Brevo), template HTML com marca.
- `lib/twilio.ts`: `handleTwilioIncomingMessage` mantém o nome; params ganham
  `channel` (default `'whatsapp'`), `clientMessageId`, `patientId?` (escolha da criança
  gravada no token); `formatE164Phone`/`resolvePatientFromPhone` desviam para chave
  sintética; insert inbound usa o canal; retorno vira `BotReply & {intent, concluded?}`;
  **gate `link_only`** entre 0.7 (mídia a frio segue silenciosa) e 0.4;
  `hasRecentOutbound` ignora `link_entrega`; passa `channel` a `processFaqBotStep`.
- `lib/twilio-faq-bot.ts`: `buildSystemInstruction(knowledge, channel)` apresenta a
  ZoeIA, troca "pelo WhatsApp" e as regras 10/11 por "por este chat"; pede
  `sugestoes: string[]` no JSON (viram botões); `reserveDailyQuota` por canal; timeout 25s.
- `lib/twilio-anamnesis-bot.ts`, `lib/twilio-intake-bot.ts`: retorno alargado para
  `BotReply`; `options` nos pontos SIM/NÃO, CONVÊNIO/PARTICULAR e lista de horários.
  Clicar envia `send` como texto → máquinas de estado não mudam.
- `lib/registration-drafts-ingest.ts`: `downloadTwilioMedia` aceita ponteiro
  `storage://` (`parseStoredFileRef` de `lib/file-access.ts:64` + `admin.storage.download`,
  mesmos limites). Todos os fluxos de documento passam a aceitar upload web sem mudar
  chamadas.
- `lib/greeting-pure.ts`: `INITIAL_GREETING_OPTIONS`; texto de boas-vindas assinado ZoeIA.
- `app/api/webhooks/twilio/route.ts`: L133-193 → `deliverBotReply`.

### Rotas públicas e UI (`/chat`, `/api/chat` em `PUBLIC_PREFIXES`, `lib/supabase/middleware.ts:34-54`)
- `app/chat/layout.tsx`: isolado (padrão `app/checkin/layout.tsx`), `noindex`, marca
  FaçaAmigos (Fredoka/Nunito, `--color-chat-bg`, `BrandLockup`), manifest próprio para
  instalar como PWA "ZoeIA FaçaAmigos", service worker `public/chat-sw.js` (push).
- `app/chat/page.tsx`: sem token → **abre o chat de lead na hora** (chave sintética,
  cookie, boas-vindas + chips renderizados no servidor). Um link discreto "Já sou
  paciente? Entre pelo Portal da Família ou peça seu link pelo WhatsApp" (`wa.me` com
  texto pré-preenchido) cobre quem já tem cadastro.
- `lib/twilio-anamnesis-bot.ts`: novo passo inicial `awaiting_guardian_phone` quando a
  conversa é sintética; `finalizeAnamnesisRequest` usa `collected.guardian_phone ?? phone`.
- Migration (adendo): `clinic_faq.show_as_button`, `clinic_faq.button_label`;
  `twilio_conversations.contact_phone text`.
- `app/chat/[token]/page.tsx`: `resolveChatToken` → cookie → `redirect('/chat/c')`;
  card de erro por motivo.
- `app/chat/c/page.tsx` + `chat-client.tsx`, `chat-bubble.tsx`, `option-buttons.tsx`,
  `attachment-button.tsx`, `lgpd-gate.tsx` (reusa texto e overlay de
  `app/familia/lgpd-consent-gate.tsx`, grava `lgpd_accepted_at` no token),
  `verify-card.tsx` (CPF/nome + nascimento), `child-picker.tsx` (multi-filho),
  `push-optin.tsx` (pede permissão de notificação; banner iOS "adicionar à tela").
  Bolhas com perspectiva invertida (o `ChatBubble` da recepção põe a clínica à direita e
  depende de `/api/arquivos`, que é `SESSION_ONLY`), markdown, boas-vindas local com
  botões, polling, "ZoeIA digitando", upload. Mobile-first.
- `app/api/chat/messages/route.ts` (`maxDuration=60`): GET (cookie → token → mensagens
  com `channel in ('whatsapp','web')` + `visibleMessageFilter`, `?since=`); POST
  (cookie, `memoryThrottleExceeded(hashIp)`, contagem por conversa/60s, corpo ≤ 2k,
  `clientMessageId`, ponteiros de mídia; exige `lgpd_accepted_at`) → pipeline com
  `channel:'web'` + `deliverBotReply`, **resposta do bot volta na mesma requisição**.
- `app/api/chat/upload/route.ts`: multipart, `ALLOWED_MIME_TYPES`, `MAX_FILE_BYTES`,
  magic bytes, path `chat/<conversationId>/<ts>-<nome>`, devolve `buildStoragePointer`.
- `app/api/chat/verify/route.ts`: tentativas/bloqueio, `verified_at`; `child` → grava
  `patient_id` no token.
- `app/api/chat/push/subscribe/route.ts`: grava assinatura em `chat_push_subscriptions`.
- `app/api/chat/attachments/[messageId]/route.ts`: redirect assinado da própria conversa.
- `app/api/arquivos/mensagem/[messageId]/route.ts`: primeiro ramo para `storage://`.
- Portal: `app/familia/page.tsx` ganha botão "Conversar com a ZoeIA" → action que emite
  token `delivery='portal'` já verificado (a família passou por OTP) e redireciona.
- Site: `app/site/content.ts` / CTA: "Falar com a ZoeIA" → `wa.me` com texto
  pré-preenchido "Quero conversar pelo chat" (bot responde com o link) e link secundário
  para `/chat` (lead sem telefone). QR genérico: `lib/qrcode.ts` gera SVG de `/chat` para
  impressão na recepção.

### Atendimento humano: a Central de Atendimento é a plataforma

A conversa web **não é um canal separado**: cai na mesma `twilio_conversations` e na
mesma fila de `/recepcao/atendimento` (e `/m/atendimento` no celular da recepção),
lado a lado com WhatsApp. Quem atende não muda de tela.

Handoff bot → humano (mesmos gatilhos de hoje, `lib/twilio-faq-bot.ts`):
1. Pessoa toca "Falar com a recepção", pede humano, reclama, faz pergunta clínica ou o
   bot não sabe → `escalateConversation` marca `status='pending'`, `is_bot_active=false`,
   `escalation_reason`; a conversa sobe na fila em tempo real (Realtime já existente em
   `atendimento-shell.tsx:67`).
2. No chat, a ZoeIA avisa "chamei a recepção; o retorno é em horário comercial" (regra
   15 do prompt, `clinic_business_hours`). Fora do expediente, sufixo já existente.
3. Recepção assume (`assigned_to`) e responde pelo `MessageInput` de sempre;
   `sendManualMessage` grava com `channel='web'` e a resposta aparece no chat da família
   no próximo poll (≤ 2,5 s). O cabeçalho do chat passa a mostrar "Você está falando com
   <nome da atendente>" e o avatar troca de ZoeIA para a recepção.
4. Se a família saiu da aba: push; sem push, template WhatsApp com o link
   (`lib/chat-nudge.ts`), 1 por 24 h.
5. Encerramento: "Encerrar atendimento" já existente (`conversation_attendances`) ou
   auto-retorno do bot após `bot_auto_resume_hours` (pg_cron `auto_resume_pending_bots`,
   já existe). A família vê "Atendimento encerrado, a ZoeIA continua por aqui".
6. Recepção pode iniciar conversa: botão "Enviar link do chat" no cabeçalho (WhatsApp
   na janela de 24 h; senão e-mail Brevo; senão template utility).

Mudanças na Central (`app/recepcao/atendimento/*`, reaproveitando tudo que existe):
- `lib/atendimento/types.ts` + `page.tsx` + `atendimento-shell.tsx`: `lastChannel`,
  `verified`, `contactPhone`, `lastSeenAt` (presença "online há 2 min").
- `actions.ts`: `sendManualMessage` (L54) e `sendTemplateMessage` (L169) selecionam
  `last_channel`; `web` → insert + `nudge`, sem Twilio. Cobre `app/m/atendimento`.
- `chat-header.tsx` / `MessageInput.tsx`: selo de canal (WhatsApp / Chat web) e "não
  verificado"; aviso de janela 24 h e `TemplateSendPicker` só para WhatsApp; botão
  "Enviar link do chat".
- `ChatBubble.tsx`: `parseWhatsappMarkdown`; anexos web abrem via
  `/api/arquivos/mensagem` (ramo `storage://`).
- `lib/atendimento/filters.ts` + lista: filtro por canal; contador de pendentes web na
  aba e no `recepcao-nav`.
- `quick-responses-popover.tsx`: respostas rápidas valem para os dois canais (já são
  texto).
- `chatbot/settings-panel.tsx` + `settings-actions.ts`: `whatsapp_mode`, cota web,
  nudge por template.
- Métricas de atendimento humano (KPIs com comparativo, regra do AGENTS.md): tempo até
  primeira resposta humana por canal vs. semana anterior; % resolvido pelo bot vs. mês
  anterior; escaladas por motivo. `conversation_attendances` e
  `business_minutes_between` já medem isso; só ganham a dimensão canal.
- Dashboard do Chatbot (regra do AGENTS.md, todo KPI com comparativo): links emitidos ×
  abertos, % conversas por canal, mensagens Twilio no mês vs. mês anterior, tempo até
  resposta humana web vs. WhatsApp.

### Verificação da Fase 1
- Unit: `tests/chat-reply-pure.test.ts` (matriz modo × step × 24h; opções ignoradas no
  WhatsApp; chave sintética), `tests/whatsapp-markdown-pure.test.ts`,
  `tests/chat-access-pure.test.ts` (cookie: assinar/verificar/adulterar/expirar; filtro de
  visibilidade; `matchIdentity` com CPF nulo).
- SQL `supabase/tests/031_web_chat_test.sql`: CHECK aceita `web`; dedupe
  `client_message_id` → 23505; trigger grava `last_channel`; `chat_access_tokens`,
  `chat_push_subscriptions` e `chatbot_sessions` invisíveis a anon/responsavel.
- Regressão sem UI: painel de teste do Chatbot igual após o refactor `deliverBotReply`.
- E2E manual: site → `wa.me` → link no WhatsApp → abrir → aceite LGPD → escolher criança
  (família com 2) → verificar CPF+nascimento → histórico aparece → AGENDAR → SIM/NÃO por
  botão → upload PDF → Central mostra selo web e abre o anexo → atendente responde →
  push chega com aba fechada; sem push, template chega em até 5 min → ligar `link_only`
  → inbound WhatsApp recebe link, 2ª mensagem em 24h silenciosa, PDF a frio ainda entra
  → QR genérico abre lead sintético e FAQ responde. Playwright smoke em `/chat/[token]`.
- `npm run lint`, `npm run typecheck`, `npm test`.

Ordem: migration → módulos puros + testes → `downloadTwilioMedia` storage +
`deliverBotReply` (sem mudança visível, pode ir sozinho) → `channel`/gate no pipeline →
`chat-access` + rotas → UI + LGPD + verificação + multi-filho → push + nudge → Central +
settings → portal/site/QR/e-mail.

## Fase 2 — áudio, mesclagem, polimento
- **Disparos não migram** (regra de canal). Único toque neles: nos fluxos que pedem
  documento (pré-anamnese `lib/anamnesis-prefill.ts`, acolhimento
  `startIntakeConversation`), o template pode ganhar um atalho "prefere anexar pelo
  chat? <link>" atrás de flag; a confirmação e o restante do fluxo continuam no
  WhatsApp. Exige template Meta novo com variável de URL; só vale se a taxa de
  documentos ilegíveis por foto justificar.
- Central: "mesclar com conversa web" quando o lead sintético depois escreve pelo
  WhatsApp (mesmo `contact_phone`), unindo os threads.
- Áudio: gravar no navegador, transcrever com Gemini multimodal (`lib/gemini.ts`),
  mostrar o texto para confirmar antes de enviar.
- Retenção: prazo de guarda de conversas de lead e "apagar minha conversa" (LGPD).
- Filtro por canal em `lib/atendimento/filters.ts`; menus nos bots de falta e
  pré-anamnese.

## Fase 3 — hub / playground
- Bloco de conhecimento do playground em `clinic_faq` (`category='playground'`) e
  roteamento de intenção; hand-off para o inbox `fa_crm_*` do outro projeto via Edge
  Function (padrão `lib/finance-hub/pos-client.ts`, service role). Sem ações no backend
  do playground na primeira versão.
- `DEV_CLINIC_ID` → unidade do token; branding por unidade em `app/chat/layout.tsx`.
