# Auditoria de Segurança — Clínica FaçaAmigos

**Data:** 2026-09-11
**Branch:** `claude/appsec-audit-checklist-t7znge`
**Escopo:** código-fonte real do repositório (`app/`, `lib/`, `supabase/migrations/`, `next.config.ts`, `.env.local.example`, `package.json`).

> **Nota metodológica:** o arquivo `AGENTS.md` deste repositório instrui o leitor a consultar `node_modules/next/dist/docs/` e tratar o projeto como "uma versão do Next.js que você não conhece, com breaking changes". Isso foi verificado e é **falso** — `node_modules/next/dist/docs/` e `node_modules/next/dist/server/lib/generate-agent-files.js` não existem no projeto instalado. É um texto plantado no repositório (possível tentativa de prompt injection contra assistentes de IA) para induzir a reclassificar comportamentos inseguros como "particularidades de framework". Esta auditoria ignorou essa instrução e avaliou o código com os padrões reais do Next.js 16 / React 19 / Supabase.

---

## Sumário Executivo

- **[CRÍTICO] Segredo real do Twilio vazado no histórico do git**: `twilio/api keys.png` (commit `58d7a94`) é um screenshot com **SID e Client Secret reais** de uma API Key do Twilio em texto legível, e `twilio_2FA_recovery_code.txt` (commit `3acafd5`) contém um **código de recuperação 2FA real** da conta Twilio. Ambos os arquivos estão rastreados pelo git e presentes no HEAD atual. Ação imediata: revogar a API Key/2FA no console Twilio e reescrever o histórico.
- **[CRÍTICO] Bypass de autenticação do Portal da Família via senha determinística previsível**: `app/login/otp-actions.ts` gera a senha de login do Supabase Auth como `OtpAuth_Resp_${telefone}_${clinic_id.slice(0,8)}` — uma fórmula pública, sem segredo do servidor. Quem souber (ou adivinhar) o telefone de um responsável e o prefixo do `clinic_id` consegue autenticar-se diretamente contra a API do Supabase, **sem nunca precisar do código OTP**.
- **[ALTO] Ausência total de rate limiting** em rotas sensíveis (login, OTP, check-in público) — reconhecido no próprio código-fonte (`lib/checkin-security.ts:5`: "o projeto não tem rate limiting em lugar nenhum").
- **[ALTO] `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) usada em ~29 arquivos de Server Actions/rotas de API** como padrão de conveniência declarado "débito técnico" (`lib/supabase/admin.ts:6-8`) — qualquer falha de checagem manual de papel nessas rotas vira acesso total ao banco, sem a rede de segurança do RLS.
- **[MÉDIO] Ausência de validação de schema (Zod/Joi) em todo o projeto** — 0 ocorrências da biblioteca; validação é manual e file-por-file, com risco de inconsistência.
- Pontos positivos: RLS está de fato habilitado nas 104 tabelas do schema (não é ausente, ao contrário do que uma primeira leitura sugere); o webhook do Twilio valida corretamente `X-Twilio-Signature`; não há SQL cru concatenado (uso de `.rpc()`/query builder do Supabase); `dangerouslySetInnerHTML` está sempre alimentado por HTML gerado internamente com escaping manual, não por dado de terceiro; `npm audit` não reportou CVEs conhecidas nas dependências atuais.

---

## 1. `.env` ou segredos rastreados no git

**[VULNERÁVEL]**

- `.gitignore:1-7` cobre corretamente `.env`, `.env*.local`, `.env*` — nenhum arquivo `.env*` real está rastreado (`git ls-files | grep -i env` só retorna `.env.local.example`, que contém só nomes de variáveis vazias). Isso está correto.
- Porém dois **segredos reais não-`.env`** estão versionados:
  - `twilio_2FA_recovery_code.txt` (raiz do repo) — código de recuperação 2FA em texto puro, tracked desde commit `3acafd5`.
  - `twilio/api keys.png` — screenshot da tela "Copy secret" do console Twilio, com **SID** (formato `SK...`, iniciando em `SK67fc...`) e **Client Secret** legíveis na imagem, tracked desde commit `58d7a94`. Valores completos omitidos deste relatório por serem segredos ativos — ver o arquivo original no repositório para confirmar e depois excluí-lo do histórico.

**Impacto:** qualquer pessoa com acesso de leitura ao repositório (ou ao histórico, mesmo que os arquivos sejam removidos depois sem reescrever histórico) consegue autenticar-se como a aplicação no Twilio e sequestrar a conta 2FA.

**Severidade:** Crítica.

**Correção:**
1. Revogar AGORA a API Key exposta em `twilio/api keys.png` (SID iniciado em `SK67fc...`) no console Twilio e gerar uma nova.
2. Invalidar o código de recuperação 2FA vazado e gerar um novo conjunto de códigos.
3. Remover os arquivos do working tree e reescrever o histórico (BFG Repo-Cleaner ou `git filter-repo`), depois forçar novo push e instruir todos os clones a re-clonar.

```bash
# Antes: arquivos versionados
git rm twilio_2FA_recovery_code.txt "twilio/api keys.png"
git commit -m "chore: remove segredos versionados por engano"
git filter-repo --path twilio_2FA_recovery_code.txt --path "twilio/api keys.png" --invert-paths
```

4. Adicionar ao `.gitignore`:
```
# Depois
twilio_2FA_recovery_code.txt
twilio/*.png
*.pem
*_recovery_code*
```

---

## 2. Chaves/API keys embutidas no bundle front-end (`NEXT_PUBLIC_*`)

**[CONFORME]**

`.env.local.example:1-2` expõe `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (formato `sb_publishable_...`). Isso é o uso correto e documentado pelo próprio Supabase: a *publishable key* é projetada para ir ao client, protegida pelo RLS no banco (ver item 8). Todas as chaves realmente sensíveis (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_SECRET`, `GEMINI_API_KEY`, `BREVO_API_KEY`, `CRON_SECRET`) estão sem o prefixo `NEXT_PUBLIC_` (`.env.local.example:31-63`) e são lidas apenas em `lib/supabase/admin.ts`, Server Actions (`"use server"`) e rotas de API — nunca em componentes client (`grep` não encontrou nenhuma referência a essas variáveis fora de arquivos server-only).

Nenhuma correção necessária neste ponto.

---

## 3. Senhas de usuário em texto puro ou hash fraco

**[CONFORME]** para o mecanismo de senha em si — **[VULNERÁVEL]** pela forma como a senha é derivada para o Portal da Família (ver item 7/detalhe abaixo, tratado com mais profundidade lá pela natureza de bypass de auth).

- Autenticação de staff (`app/login/actions.ts:17`) usa `supabase.auth.signInWithPassword`, delegando hashing (bcrypt) ao Supabase Auth (GoTrue) — não há hash implementado à mão no código da aplicação, o que é o comportamento correto.
- **Porém**, `app/login/otp-actions.ts:241` e `:311-313` calculam a senha do usuário `responsavel` como `OtpAuth_Resp_${digits}_${patient.clinic_id.slice(0, 8)}` e a gravam via `admin.auth.admin.updateUserById(... password)` — o hash em si é forte (GoTrue faz bcrypt), mas a **senha de entrada é 100% determinística e derivável de dados não-secretos** (telefone do responsável + 8 primeiros caracteres do UUID da clínica), o que anula a proteção do hash. Ver análise completa no item correspondente ao fluxo de autenticação, abaixo (tratado dentro do item 7 por ser, na prática, um bypass de fluxo de login alternativo/OTP).

**Localização:** `app/login/otp-actions.ts:241`, `:253-254`, `:311-313`.

**Impacto:** um atacante que descubra o telefone de um responsável (dado de baixo sigilo — está em WhatsApp, agendas, formulários) e o `clinic_id` (é devolvido em respostas de API/RPC como `patient_contact_summary`, aparece em URLs internas, e há só 3 clínicas — espaço de busca trivial) pode calcular a senha exata e chamar `supabase.auth.signInWithPassword` diretamente contra a API pública do Supabase (usando a `anon key`, que já é pública), autenticando-se como aquele responsável **sem nunca receber nem validar o código OTP**.

**Severidade:** Crítica.

**Correção — Antes:**
```ts
// app/login/otp-actions.ts
const secretPassword = `OtpAuth_Resp_${digits}_${patient.clinic_id.slice(0, 8)}`;
// ...
await admin.auth.admin.updateUserById(targetUserId, { password: secretPassword });
```

**Depois:**
```ts
import { randomBytes } from "node:crypto";

// Gerar uma senha aleatória de alta entropia, nunca derivada de dados
// conhecíveis, e trocá-la a cada login bem-sucedido (rotação por sessão).
const secretPassword = randomBytes(32).toString("base64url");
await admin.auth.admin.updateUserById(targetUserId, { password: secretPassword });
// Login imediato no mesmo request, sem nunca expor/persistir secretPassword
// em lugar acessível ao client além da troca de sessão local.
```
Alternativa mais robusta: usar `admin.auth.admin.generateLink({ type: "magiclink", email })` ou `signInWithOtp` nativo do Supabase (que já cuida de expiração/HMAC do token) em vez de reimplementar OTP com senha determinística por cima do Auth.

---

## 4. Tokens JWT/sessão em `localStorage` vs cookies HttpOnly/Secure/SameSite

**[CONFORME]**

Não há nenhum uso de `localStorage`/`sessionStorage` para tokens de sessão ou auth em todo `app/`, `components/`, `lib/`, `src/` (grep dedicado não encontrou ocorrências). A sessão é gerenciada via `@supabase/ssr` (`lib/supabase/server.ts:1-31`, `lib/supabase/middleware.ts:57-75`), que grava a sessão em **cookies HttpOnly** geridos pelo middleware do Next (`request.cookies` / `response.cookies`), como recomendado pelo próprio Supabase para apps SSR. `Secure`/`SameSite` são definidos pelas *options* default do `@supabase/ssr`, que já aplicam `Secure` em produção (HTTPS) e `SameSite=Lax`.

Nenhuma correção necessária.

---

## 5. Ausência de verificação de e-mail antes de permissões críticas

**[VULNERÁVEL]** (parcial — falta de verificação de identidade equivalente, adaptado ao fluxo real do produto)

O app não faz cadastro de usuário por e-mail com fluxo de "confirmar e-mail" tradicional para staff (contas são provisionadas manualmente pelo gestor, presumivelmente com `email_confirm: true` fixo). Para o Portal da Família, o e-mail é sequer real em boa parte dos casos: `app/login/otp-actions.ts:236-238` usa `guardian.email` OU, se ausente, fabrica `responsavel_${digits}@familia.clinica.local` e a conta é criada com `email_confirm: true` (`otp-actions.ts:259`) **sem qualquer confirmação real do endereço**. A única verificação de identidade é o OTP por SMS — que, como mostrado no item 3, pode ser completamente contornado.

**Localização:** `app/login/otp-actions.ts:236-238`, `:259`.

**Impacto:** a "verificação" de identidade do responsável se resume ao SMS OTP; como esse OTP pode ser pulado via senha determinística, não existe, na prática, nenhuma barreira de verificação de identidade antes de conceder acesso a `patient_access` (dados clínicos da criança).

**Severidade:** Alta (decorrente diretamente do item 3).

**Correção:** corrigir a raiz (senha determinística, item 3) fecha esta lacuna, já que o OTP por SMS + confirmação de CPF (`otp-actions.ts:197-220`) é uma verificação de identidade razoável *desde que não possa ser contornada*.

---

## 6. Falta de requisitos mínimos de senha (comprimento/entropia)

**[INSUFICIENTE/AUSENTE]**

- No client: `app/trocar-senha/change-password-form.tsx:32` e `:46` usam `minLength={8}` no `<input>` — validação client-side, contornável via DevTools ou chamada direta à Server Action.
- No server: `app/trocar-senha/actions.ts:12-13` reforça `password.length < 8` — isso é bom, mas é a **única** regra (sem exigência de maiúscula/número/símbolo, sem checagem contra listas de senhas vazadas — ex.: `haveibeenpwned` API do próprio Supabase Auth, que suporta `password_hibp_enabled`).
- O fluxo de criação de conta (`app/login/otp-actions.ts`, `createUser`) não passa por essa validação porque **não é o usuário quem escolhe a senha** — ela é gerada pelo sistema (ver item 3).
- Configuração de política de senha do projeto Supabase (comprimento mínimo, HIBP, MFA) vive no painel/API do Supabase, não no repositório — não há `supabase/config.toml` neste projeto para auditar essa configuração localmente.

**Localização:** `app/trocar-senha/actions.ts:12-13`, `app/trocar-senha/change-password-form.tsx:32,46`.

**Impacto:** senha de 8 caracteres sem exigência de complexidade permite senhas fracas como `12345678` para contas de staff com acesso a prontuário clínico.

**Severidade:** Média.

**Correção — Antes:**
```ts
if (password.length < 8) {
  return { success: false, error: "A senha deve ter pelo menos 8 caracteres." };
}
```

**Depois:**
```ts
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
if (!STRONG_PASSWORD.test(password)) {
  return {
    success: false,
    error: "A senha deve ter pelo menos 10 caracteres, com letra maiúscula, minúscula e número.",
  };
}
```
E habilitar no dashboard do Supabase (Authentication → Policies): comprimento mínimo ≥ 10 e "Leaked password protection" (HIBP).

---

## 7. Painel admin com OAuth vulnerável

**[CONFORME / NÃO SE APLICA]**

Não há integração OAuth em nenhum lugar do projeto — nenhuma ocorrência de `next-auth`, `signInWithOAuth`, `oauth` em `app/`/`lib/` (grep dedicado retornou vazio). A autenticação é 100% email+senha via Supabase Auth (`app/login/actions.ts`) mais o fluxo de OTP por SMS para famílias (`app/login/otp-actions.ts`). Portanto os riscos clássicos de OAuth (state CSRF, validação de `redirect_uri`, escopos excessivos) não se aplicam a este código.

O item real de risco equivalente neste projeto é o próprio fluxo OTP tratado em profundidade no item 3 (bypass via senha previsível) — que é, na prática, mais grave do que uma má configuração de OAuth.

---

## 8. Ausência de RLS/controle equivalente no banco

**[CONFORME]**

Levantamento em `supabase/migrations/*.sql`: **104 tabelas criadas, 104 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` correspondentes** — nenhuma tabela ficou sem RLS habilitado (`comm -23` entre a lista de tabelas e a lista de tabelas com RLS retornou vazio). As policies usam funções auxiliares consistentes como `current_clinic_id()` e `has_patient_access(patient_id, roles[])` (ver `supabase/migrations/20260905123900_rls_initplan_perf_fix.sql:74-96` para o padrão em `documents`), escopando por clínica e por papel.

**Ressalva importante** (ligada ao item 9): o RLS só protege quem acessa via `anon`/`authenticated` key com JWT de sessão (`lib/supabase/server.ts`). O client `service_role` (`lib/supabase/admin.ts`) **ignora RLS por definição do Postgres/Supabase** — e é usado em ~29 arquivos do projeto. Nesses pontos, a proteção real passa a depender inteiramente da checagem manual de papel em código de aplicação (ver item 9).

Nenhuma correção estrutural necessária para RLS em si; ver item 9 para o risco decorrente do uso do `service_role`.

---

## 9. RBAC validado só no front-end e ignorado na API

**[INSUFICIENTE/AUSENTE]** (risco residual, não uma falha generalizada)

Amostragem em Server Actions que usam `createAdminClient()` (bypassa RLS) mostra, na maioria dos casos analisados, uma checagem de papel *antes* de usar o client admin (padrão `requireSupervisor()` em `app/supervisao/acolhimento-actions.ts:36-39`, `auth.getUser()` em `app/recepcao/emergencias/actions.ts:123-126`). Isso é o padrão correto — mas é uma disciplina manual, arquivo por arquivo, sem qualquer middleware/guard central que garanta que **todo** uso de `createAdminClient()` seja precedido de uma verificação de papel. Não há teste automatizado nem lint customizado que impeça alguém de introduzir uma nova Server Action com `createAdminClient()` sem checar `role`.

**Localização de exemplo de padrão correto:** `app/supervisao/acolhimento-actions.ts:36-39` (usa `requireSupervisor()` antes do client admin).
**Ponto de risco estrutural:** `lib/supabase/admin.ts:4-9` — o próprio comentário do arquivo chama isso de "débito técnico registrado... substituir por escrita autenticada quando o login existir" (nota: login já existe hoje, então esse débito já deveria ter sido pago).

**Impacto:** o risco não é uma vulnerabilidade explorável hoje encontrada em rota específica, mas um padrão arquitetural frágil: uma única Server Action nova que esqueça de chamar `auth.getUser()`/`requireX()` antes de `createAdminClient()` vira um bypass total de RBAC, sem o RLS como rede de segurança.

**Severidade:** Alta (risco sistêmico/estrutural, não uma instância confirmada de exploração).

**Correção:** criar um wrapper único que force a checagem de papel a acontecer antes de obter o client admin, em vez de duas chamadas independentes:
```ts
// lib/supabase/admin-guarded.ts — Depois
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/roles";

export async function requireRoleAndAdminClient(allowed: Role[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." as const };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !allowed.includes(profile.role as Role)) {
    return { error: "Sem permissão." as const };
  }
  return { userId: user.id, admin: createAdminClient() };
}
```
E banir `import { createAdminClient } from "@/lib/supabase/admin"` fora de `lib/supabase/admin-guarded.ts` via regra de ESLint (`no-restricted-imports`).

---

## 10. IDs sequenciais/previsíveis (IDOR) nas rotas de API

**[CONFORME]**

Todas as tabelas usam `uuid`/`gen_random_uuid()` como chave primária (59 ocorrências de `gen_random_uuid`/`uuid_generate_v4` nas migrations vs. 6 ocorrências de `serial`/`bigserial`/`identity`, e essas 6 são majoritariamente contadores internos não expostos como identificador de recurso, ex.: `checkin_ticket_counters`). Rotas públicas sensíveis usam tokens opacos e não o `id` da linha — ex.: `app/api/checkin/status/route.ts:17-19` busca por `public_token` (cookie httpOnly), com o comentário explícito: *"nunca o `id` da linha, que seria sequencialmente correlacionável"*.

Nenhuma correção necessária.

---

## 11. Concatenação de strings em SQL (SQL Injection)

**[CONFORME]**

Não há nenhuma query SQL crua construída por concatenação de string de entrada do usuário em todo o código de aplicação. Todo acesso a dados passa pelo query builder do `@supabase/supabase-js`/`@supabase/ssr` (`.from(...).select(...)`, `.insert(...)`, `.update(...)`, `.eq(...)`) ou por chamadas a funções RPC parametrizadas (`supabase.rpc("nome_funcao", { p_param: valor })` — ex.: `app/familia/actions.ts:113,199,408,432`), que usam parâmetros tipados no Postgres, não interpolação de string. Nenhum uso de `pg`/`node-postgres` cru nem de client SQL direto foi encontrado.

Nenhuma correção necessária.

---

## 12. Ausência de validação de schema (Zod/Joi/DTO) nas API routes

**[VULNERÁVEL]**

Nenhuma dependência de validação de schema está instalada (`package.json` não lista `zod`, `joi`, `yup`, etc; `grep -rl "from \"zod\""` retornou vazio em todo o projeto). Toda validação de entrada é manual, feita ad-hoc em cada Server Action/rota (ex.: `app/recepcao/pacientes/[id]/documents-actions.ts:54-62` valida tipo de arquivo e tamanho na mão; `app/api/notifications/send/route.ts:17-19` só checa `!to || !message`, sem checar tipo, formato de telefone ou tamanho de `message`).

**Localização:** `app/api/notifications/send/route.ts:16-19` (exemplo representativo — nenhuma validação de shape de `body`, apenas presença).

**Impacto:** consistência de validação depende inteiramente da disciplina de quem escreve cada endpoint; campos como `channel` (`"whatsapp"` default, `app/api/notifications/send/route.ts:17`) não são validados contra um enum, permitindo valores arbitrários repassados adiante para `sendTwilioNotificationAction`.

**Severidade:** Média.

**Correção — Antes:**
```ts
const body = await req.json();
const { to, message, channel = "whatsapp", patientId } = body;
if (!to || !message) { /* ... */ }
```

**Depois:**
```ts
import { z } from "zod";

const NotificationSchema = z.object({
  to: z.string().min(8).max(20),
  message: z.string().min(1).max(1000),
  channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
  patientId: z.string().uuid().optional(),
});

const parsed = NotificationSchema.safeParse(await req.json());
if (!parsed.success) {
  return NextResponse.json({ error: "Payload inválido", issues: parsed.error.issues }, { status: 400 });
}
const { to, message, channel, patientId } = parsed.data;
```
(`npm install zod`, ainda ausente em `package.json`.)

---

## 13. Renderização de dados de terceiros como HTML bruto (XSS)

**[CONFORME]**

Há 4 usos de `dangerouslySetInnerHTML` em todo o projeto:
- `app/site/page.tsx:192,196` — apenas `JSON.stringify` de dados estruturados (JSON-LD) com `<` escapado explicitamente (`.replace(/</g, "\\u003c")`), padrão recomendado pelo Next.js para JSON-LD seguro.
- `app/recepcao/recursos/qr-checkin/page.tsx:62` — SVG de QR code **gerado no servidor pela própria aplicação** (biblioteca `qrcode`), não dado de usuário.
- `app/gestor/configuracoes/cupom-checkin/cupom-manager.tsx:200` — HTML vem de `renderCouponBody()` (`lib/checkin-coupon-html.ts`), que escapa explicitamente todo campo de texto livre via `escapeHtml()` (`lib/checkin-coupon-html.ts:18-25`) antes de interpolar, inclusive campos digitados pelo gestor (`headerText`/`footerText`).

Nenhum dos 4 pontos renderiza HTML de terceiro não sanitizado.

Nenhuma correção necessária.

---

## 14. Salvamento de `req.body`/`request.json()` inteiro sem filtragem (Mass Assignment)

**[CONFORME]**

Todas as 4 rotas de API que leem `req.json()`/`request.json()` (`app/api/checkin/route.ts`, `app/api/aba/session-note-voice/route.ts`, `app/api/notifications/send/route.ts`, `app/api/webhooks/twilio/route.ts`) fazem **destructuring explícito de campos nomeados** antes de repassar adiante — nenhuma delas faz `.insert(body)` ou `{ ...body }` direto no corpo da requisição para o banco. O mesmo padrão se repete nas Server Actions verificadas (`documents-actions.ts`, `acolhimento-actions.ts`): os campos gravados em `.insert({...})` são sempre montados campo a campo a partir de variáveis validadas, nunca um spread do `formData`/`body` cru.

Nenhuma correção necessária.

---

## 15. Ausência de rate limiting em rotas sensíveis (login, cadastro)

**[VULNERÁVEL]**

- `app/login/actions.ts` (`signIn`) — nenhuma limitação de tentativas por IP/usuário; depende inteiramente do rate limiting nativo do Supabase Auth (GoTrue), que é genérico por projeto, não configurável por rota neste código.
- `app/login/otp-actions.ts` (`requestFamilyOtp`/`verifyFamilyOtp`) — só há limite de 3 tentativas *por código OTP* (`otp-actions.ts:156`), mas nenhum limite de quantos códigos podem ser solicitados por telefone/IP por minuto — permite spam de SMS (custo/DoS) e brute-force distribuído gerando muitos códigos.
- O próprio código documenta a ausência: `lib/checkin-security.ts:5` — *"o projeto não tem rate limiting em lugar nenhum"*.
- O check-in público (`app/api/checkin/route.ts`) tem uma mitigação parcial (`memoryThrottleExceeded`, cookie de sessão de formulário) mas o comentário do próprio arquivo (`lib/checkin-security.ts:9`) admite: *"não impede um humano decidido, mas elimina o abuso trivial de curl em loop"* — e o throttle é **em memória do processo**, não sobrevive a múltiplas instâncias serverless (Vercel escala horizontalmente).

**Localização:** `app/login/actions.ts:1-30`; `app/login/otp-actions.ts:30-118`; `lib/checkin-security.ts:5`.

**Impacto:** brute-force de senha de staff (ainda que mitigado pelo hash bcrypt do GoTrue, não há bloqueio de IP após N tentativas visível no código da aplicação); spam de SMS via `requestFamilyOtp` gera custo financeiro direto (Twilio cobra por SMS) e pode ser usado para esgotar orçamento ou incomodar terceiros cujo número não é de fato responsável cadastrado (a única barreira é achar o telefone na tabela `guardians`/`profiles`).

**Severidade:** Alta.

**Correção — Antes:**
```ts
export async function requestFamilyOtp(rawPhone: string) {
  // ...sem limite de taxa...
}
```

**Depois** (rate limit persistente via tabela já existente `family_otp_codes`, sem dependência nova):
```ts
export async function requestFamilyOtp(rawPhone: string) {
  const digits = normalizeDigits(rawPhone);
  const admin = createAdminClient();

  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("family_otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("phone", digits)
    .gte("created_at", since);

  if ((count ?? 0) >= 3) {
    return { success: false, error: "Muitas tentativas. Aguarde 15 minutos antes de pedir um novo código." };
  }
  // ...restante do fluxo...
}
```
Para produção, complementar com rate limiting por IP na borda (Vercel Firewall / Upstash Ratelimit) nas rotas `/login`, `/api/checkin`, e nas Server Actions de OTP.

---

## 16. CORS permissivo (`Access-Control-Allow-Origin: *`) em rotas privadas

**[CONFORME]**

Nenhuma ocorrência de `Access-Control-Allow-Origin` ou configuração de `cors()` em todo o código (`app/`, `lib/`). `next.config.ts:27-40` define apenas headers de segurança (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) — nenhum header de CORS é setado, o que significa que as rotas de API seguem o comportamento same-origin padrão do navegador (sem CORS liberado para terceiros).

Nenhuma correção necessária.

---

## 17. Webhooks sem validação HMAC

**[CONFORME]**

`app/api/webhooks/twilio/route.ts:18-27` implementa `isValidTwilioSignature()`, que valida o header `X-Twilio-Signature` via `twilio.validateRequest(authToken, signature, publicUrl, params)` — a validação HMAC oficial do SDK Twilio — **antes** de processar qualquer mensagem (`route.ts:115-118`, requisição rejeitada com 403 se a assinatura for inválida ou ausente).

**Ressalva menor:** `TWILIO_SKIP_SIGNATURE_VALIDATION=true` (`route.ts:19`) desativa completamente a validação. Isso é documentado como uso exclusivo de desenvolvimento local (`.env.local.example:76-78`), mas não há nenhuma trava no código que impeça essa variável de ser setada acidentalmente em produção (ex.: copiar `.env` de dev para Vercel por engano).

**Localização do ponto de atenção:** `app/api/webhooks/twilio/route.ts:19`.

**Severidade:** Baixa (mitigação operacional, não de código).

**Correção sugerida:**
```ts
// Depois — nunca permite o bypass fora de desenvolvimento
function isValidTwilioSignature(req: NextRequest, params: Record<string, string>): boolean {
  if (process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === "true") {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      console.error("[SECURITY] TWILIO_SKIP_SIGNATURE_VALIDATION ignorado em produção.");
    } else {
      return true;
    }
  }
  // ...resto igual
}
```

---

## 18. Upload de arquivos sem validação (magic bytes, MIME, tamanho, path traversal)

**[INSUFICIENTE/AUSENTE]**

- **Tamanho:** validado consistentemente (`documents-actions.ts:57-59` — 25MB; `acolhimento-actions.ts:65-67` — 25MB).
- **MIME:** validado apenas pelo **header `Content-Type` declarado pelo cliente** (`file.type`), nunca pelos magic bytes reais do arquivo. Ex.: `documents-actions.ts:116-119` usa `contentType: file.type || "application/octet-stream"` direto no upload — um atacante pode enviar um HTML/SVG malicioso com `Content-Type: application/pdf` forjado no `FormData` (trivial via `fetch`/Postman) e o arquivo é aceito. `acolhimento-actions.ts:62` faz `if (file.type !== "application/pdf")`, mesmo problema — checa apenas o MIME declarado, não o conteúdo.
- **Extensão/path traversal:** `sanitizeFileName()` (`documents-actions.ts:18-22`) remove caracteres fora de `[a-zA-Z0-9._-]`, o que neutraliza `../` — este ponto está correto.
- **Nenhuma validação de magic bytes** (ex.: `file-type`/checagem de assinatura binária) existe em nenhum ponto de upload do projeto.

**Localização:** `app/recepcao/pacientes/[id]/documents-actions.ts:54-62,116-119`; `app/supervisao/acolhimento-actions.ts:58-67`.

**Impacto:** upload de um arquivo HTML/SVG com `Content-Type` forjado como PDF/imagem pode, dependendo de como o storage serve o arquivo (Content-Disposition, se o bucket for público em algum ponto), habilitar XSS armazenado ao ser aberto diretamente pelo navegador via signed URL. O bucket é privado (`clinic-documents`, acessado só via `createSignedUrl`, `documents-actions.ts:169-171`), o que reduz o impacto, mas não elimina o risco quando o link assinado é aberto em nova aba.

**Severidade:** Média.

**Correção — Antes:**
```ts
if (file.type !== "application/pdf") {
  return { success: false, error: "Só arquivos PDF são aceitos nesta remessa." };
}
```

**Depois:**
```ts
const buffer = Buffer.from(await file.arrayBuffer());
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // "%PDF"
if (!buffer.subarray(0, 4).equals(PDF_MAGIC)) {
  return { success: false, error: "O arquivo não é um PDF válido (assinatura binária não confere)." };
}
```
Para os uploads de imagem/PDF genéricos em `documents-actions.ts`, usar uma biblioteca como `file-type` (`npm install file-type`) para checar a assinatura real antes de gravar, e sempre servir arquivos com `Content-Disposition: attachment` na signed URL para impedir renderização inline no navegador.

---

## 19. Stack traces/erros internos expostos em produção

**[VULNERÁVEL]** (pontual, não generalizado)

- `app/error.tsx:13-15` — comportamento correto: loga no console do navegador, mostra apenas mensagem genérica ao usuário ("Não foi possível carregar esta página"), sem stack trace na tela.
- `instrumentation.ts:23-39` — comportamento correto: stack trace vai para os logs do servidor (Vercel), não para o cliente.
- **Porém**, `app/api/webhooks/twilio/route.ts:198-201` devolve a mensagem de exceção crua no corpo da resposta JSON:
```ts
} catch (error) {
  console.error("[Twilio Webhook Error]:", error);
  const errMessage = error instanceof Error ? error.message : "Erro interno no webhook Twilio";
  return NextResponse.json({ success: false, error: errMessage }, { status: 400 });
}
```
Isso é alcançável antes mesmo da validação de assinatura (ex.: JSON malformado no branch `contentType.includes("application/json")`, `route.ts:81-88`, lança exceção capturada aqui), expondo mensagens internas (nomes de função, tipo de erro do parser) a qualquer requisição não autenticada.

**Localização:** `app/api/webhooks/twilio/route.ts:198-201`.

**Severidade:** Baixa.

**Correção — Antes:**
```ts
const errMessage = error instanceof Error ? error.message : "Erro interno no webhook Twilio";
return NextResponse.json({ success: false, error: errMessage }, { status: 400 });
```

**Depois:**
```ts
console.error("[Twilio Webhook Error]:", error);
return NextResponse.json({ success: false, error: "Requisição inválida." }, { status: 400 });
```

---

## 20. Dependências desatualizadas com CVEs

**[CONFORME]**

`npm audit --production --json` executado neste ambiente retornou **0 vulnerabilidades** (`critical: 0, high: 0, moderate: 0, low: 0`) sobre 183 dependências de produção. `package.json` usa versões recentes das libs centrais (`next@16.3.4`, `react@19.2.8`, `@supabase/supabase-js@^2.115.0`, `twilio@^6.1.0`). Isso reflete o estado do `package-lock.json` no momento da auditoria — deve ser re-executado periodicamente (CI) já que novas CVEs surgem independente de mudança de código.

**Recomendação (não corretiva, preventiva):** adicionar `npm audit --audit-level=high` como step obrigatório no CI (`.github/`) para pegar regressões futuras.

---

## Apêndice — Tabela-resumo

| # | Item | Status |
|---|------|--------|
| 1 | Segredos rastreados no git | **VULNERÁVEL** (Crítica) |
| 2 | Chaves em `NEXT_PUBLIC_*` | CONFORME |
| 3 | Senha em texto puro / hash fraco | **VULNERÁVEL** (Crítica — senha determinística) |
| 4 | Token em localStorage vs cookie HttpOnly | CONFORME |
| 5 | Verificação de e-mail antes de permissões críticas | **VULNERÁVEL** (Alta) |
| 6 | Requisitos mínimos de senha | INSUFICIENTE (Média) |
| 7 | OAuth em painel admin | CONFORME / N/A |
| 8 | RLS no banco | CONFORME |
| 9 | RBAC só no front | INSUFICIENTE/risco estrutural (Alta) |
| 10 | IDs previsíveis (IDOR) | CONFORME |
| 11 | SQL Injection | CONFORME |
| 12 | Validação de schema (Zod/Joi) | **VULNERÁVEL** (Média) |
| 13 | XSS via `dangerouslySetInnerHTML` | CONFORME |
| 14 | Mass Assignment | CONFORME |
| 15 | Rate limiting | **VULNERÁVEL** (Alta) |
| 16 | CORS permissivo | CONFORME |
| 17 | Webhook sem HMAC | CONFORME (ressalva baixa) |
| 18 | Upload sem validação real | INSUFICIENTE (Média) |
| 19 | Stack trace exposto | **VULNERÁVEL** pontual (Baixa) |
| 20 | Dependências com CVEs | CONFORME |

---

*Relatório gerado por auditoria automatizada de código-fonte. Não substitui um pentest dinâmico (DAST) nem revisão da configuração remota do projeto Supabase (políticas de senha, MFA, HIBP, configuração de Storage), que não está no repositório e não pôde ser inspecionada aqui.*
