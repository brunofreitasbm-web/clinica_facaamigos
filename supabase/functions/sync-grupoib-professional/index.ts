import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = "289ed0887c3a73ca49b687762b258805dc199f0ff6c9f70328395d739f074e23";

const CLINIC_ID = "c0000000-0000-0000-0000-000000000001";
const TARGET_UNIT_ID = "clinica-a";

// E-mail de primeiro acesso (Brevo). Sem BREVO_API_KEY o sync continua
// funcionando normalmente — só o e-mail é pulado (e registrado no
// audit_log), pra um secret faltando nunca derrubar a sincronização.
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_FROM = Deno.env.get("BREVO_FROM") ?? "FaçaAmigos <nao-responda@facaamigos.com.br>";
const APP_LOGIN_URL = Deno.env.get("APP_LOGIN_URL") ?? "https://app.facaamigos.com.br/login";
const SUPPORT_CONTACT = Deno.env.get("SUPPORT_CONTACT") ?? "a recepção da clínica";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) {
    let dummy = 0;
    const len = Math.max(bufA.length, bufB.length);
    for (let i = 0; i < len; i++) dummy |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
    return false;
  }
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

function stripAccents(s: string) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// CPF só entra na sincronização com 11 dígitos válidos — mesma normalização
// usada no login por CPF da equipe (app/login/actions.ts) e no cadastro
// manual (app/gestor/equipe/actions.ts), pra garantir que os dois caminhos
// gravam o CPF no mesmo formato em profiles.cpf.
function normalizeCpf(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

// Senha inicial aleatória (não previsível a partir do nome) — a pessoa é
// obrigada a trocá-la no primeiro login via must_change_password. Garante os
// requisitos mínimos do sistema: 6+ caracteres, 1 maiúscula, 1 especial
// (ver lib/password.ts, mesma regra usada em toda troca de senha do app).
function buildInitialPassword(): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${random}Aa1!`;
}

type Specialty = { id: string; value: string; label: string; sort_order?: number };

async function loadSpecialties(): Promise<Specialty[]> {
  const { data } = await admin
    .from("specialties")
    .select("id, value, label, sort_order")
    .eq("clinic_id", CLINIC_ID)
    .eq("active", true)
    .order("sort_order");
  return data ?? [];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function charSimilarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / new Set([...ta, ...tb]).size;
}

function bestScore(a: string, b: string): number {
  return Math.max(charSimilarity(a, b), tokenSimilarity(a, b));
}

const CANONICAL_SPECIALTIES: { value: string; label: string; keywords: string[] }[] = [
  { value: "psicologia_aba", label: "Psicologia ABA", keywords: ["psicolog", "psicoterap", "aba", "analista do comportamento"] },
  { value: "fonoaudiologia", label: "Fonoaudiologia", keywords: ["fono"] },
  { value: "terapia_ocupacional", label: "Terapia Ocupacional", keywords: ["terapia ocupacional", "terapeuta ocupacional", " to "] },
  { value: "fisioterapia", label: "Fisioterapia", keywords: ["fisioterap"] },
  { value: "musicoterapia", label: "Musicoterapia", keywords: ["musicoterap"] },
  { value: "psicopedagogia", label: "Psicopedagogia", keywords: ["psicopedagog"] },
  { value: "nutricao", label: "Nutricao", keywords: ["nutri"] },
  { value: "odontologia", label: "Odontologia", keywords: ["odont", "dentista"] },
  { value: "medicina", label: "Medicina", keywords: ["medic", "pediatr", "psiquiatr", "neurolog"] },
  { value: "enfermagem", label: "Enfermagem", keywords: ["enferm"] },
  { value: "pedagogia", label: "Pedagogia", keywords: ["pedagog"] },
  { value: "educacao_fisica", label: "Educacao Fisica", keywords: ["educador fisico", "educadora fisica", "educacao fisica"] },
];

function matchCanonical(normalizedProfession: string) {
  const padded = ` ${normalizedProfession} `;
  return CANONICAL_SPECIALTIES.find((c) => c.keywords.some((k) => padded.includes(stripAccents(k).toLowerCase())));
}

function slugify(label: string) {
  return stripAccents(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toTitleCase(s: string) {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

async function ensureSpecialty(value: string, label: string, specialties: Specialty[]): Promise<Specialty | null> {
  const existing = specialties.find((s) => s.value === value);
  if (existing) return existing;

  const maxSort = Math.max(0, ...specialties.map((s) => s.sort_order ?? 0));
  const { data: created, error } = await admin
    .from("specialties")
    .insert({ clinic_id: CLINIC_ID, value, label, sort_order: maxSort + 1, active: true })
    .select("id, value, label")
    .single();

  if (!error && created) return created;

  const { data: found } = await admin
    .from("specialties")
    .select("id, value, label")
    .eq("clinic_id", CLINIC_ID)
    .eq("value", value)
    .maybeSingle();
  return found ?? null;
}

const FUZZY_THRESHOLD = 0.55;

async function matchDiscipline(professionText: string): Promise<Specialty | null> {
  const specialties = await loadSpecialties();
  const fallbackOutro = specialties.find((s) => s.value === "outro") ?? specialties[0] ?? null;

  const normalized = stripAccents(professionText ?? "").toLowerCase().trim();
  if (!normalized) return fallbackOutro;

  const canonical = matchCanonical(normalized);
  if (canonical) {
    const ensured = await ensureSpecialty(canonical.value, canonical.label, specialties);
    if (ensured) return ensured;
  }

  let best: { specialty: Specialty; score: number } | null = null;
  for (const s of specialties) {
    if (s.value === "outro") continue;
    const score = bestScore(normalized, stripAccents(s.label).toLowerCase());
    if (!best || score > best.score) best = { specialty: s, score };
  }
  if (best && best.score >= FUZZY_THRESHOLD) return best.specialty;

  const label = toTitleCase(professionText);
  const value = slugify(label);
  if (value) {
    const created = await ensureSpecialty(value, label, specialties);
    if (created) return created;
  }

  return fallbackOutro;
}

// ---------------------------------------------------------------------------
// E-mail de primeiro acesso (Brevo)
// ---------------------------------------------------------------------------

function parseAddress(address: string): { name?: string; email: string } {
  const match = address.match(/^(.*)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { name: name || undefined, email: match[2].trim() };
  }
  return { email: address.trim() };
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(fullName: string) {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

type AccessEmail =
  | { kind: "new_account"; password: string }
  | { kind: "existing_account" };

// `login` é o que a pessoa vai digitar na tela de entrar — CPF quando
// cadastrado (novo padrão da equipe), e-mail como fallback quando não há CPF.
function buildAccessEmail(params: { name: string; login: string; variant: AccessEmail }) {
  const first = firstName(params.name);
  const greeting = first ? `Olá, ${first}!` : "Olá!";
  const isNew = params.variant.kind === "new_account";

  const subject = isNew
    ? "Seu acesso ao sistema da FaçaAmigos - Centro de Terapia Comportamental"
    : "Seu acesso ao sistema da FaçaAmigos - Centro de Terapia Comportamental foi liberado";

  const credentialsHtml = isNew
    ? `<p style="margin:0 0 8px"><strong>Login:</strong> ${escapeHtml(params.login)}</p>
       <p style="margin:0"><strong>Senha inicial:</strong> <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px;font-size:15px">${
      escapeHtml((params.variant as { password: string }).password)
    }</code></p>`
    : `<p style="margin:0"><strong>Login:</strong> ${escapeHtml(params.login)}</p>
       <p style="margin:8px 0 0">Use a mesma senha que você já utiliza. Se não lembrar, fale com ${
      escapeHtml(SUPPORT_CONTACT)
    }.</p>`;

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f7f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;margin:0 0 16px;color:#f0196b">FaçaAmigos - Centro de Terapia Comportamental</h1>
    <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px">Seu cadastro chegou do sistema de gestão do Grupo IB e sua conta no sistema da clínica já está pronta.</p>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 16px">
      ${credentialsHtml}
    </div>
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(APP_LOGIN_URL)}" style="display:inline-block;background:#f0196b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Acessar o sistema</a>
    </p>
    ${
    isNew
      ? `<p style="margin:0 0 16px;font-size:13px;color:#4b5563">Por segurança, o sistema vai pedir que você <strong>troque essa senha no primeiro login</strong>. Não compartilhe estas credenciais com ninguém.</p>`
      : ""
  }
    <p style="margin:0;font-size:13px;color:#6b7280">Dúvidas? Fale com ${
    escapeHtml(SUPPORT_CONTACT)
  }. Esta mensagem é automática — não responda.</p>
  </div>
</body></html>`;

  const text = isNew
    ? `${greeting}\n\nSeu cadastro chegou do sistema de gestão do Grupo IB e sua conta no sistema da FaçaAmigos - Centro de Terapia Comportamental já está pronta.\n\nLogin: ${params.login}\nSenha inicial: ${
      (params.variant as { password: string }).password
    }\n\nAcesse: ${APP_LOGIN_URL}\n\nPor segurança, o sistema vai pedir que você troque essa senha no primeiro login. Não compartilhe estas credenciais com ninguém.\n\nDúvidas? Fale com ${SUPPORT_CONTACT}. Mensagem automática — não responda.`
    : `${greeting}\n\nSeu acesso ao sistema da FaçaAmigos - Centro de Terapia Comportamental foi liberado.\n\nLogin: ${params.login}\nUse a mesma senha que você já utiliza. Se não lembrar, fale com ${SUPPORT_CONTACT}.\n\nAcesse: ${APP_LOGIN_URL}\n\nMensagem automática — não responda.`;

  return { subject, html, text };
}

type EmailResult = { status: "sent"; id?: string } | { status: "skipped" | "failed"; reason: string };

/**
 * Envia via Brevo com uma retentativa. Se falhar de vez numa conta recém-criada,
 * o profissional fica sem saber a senha (que não é recuperável daqui), então o
 * fracasso precisa ficar registrado no audit_log para alguém agir manualmente.
 */
async function sendAccessEmail(
  params: { to: string; login: string; name: string; variant: AccessEmail },
): Promise<EmailResult> {
  if (!BREVO_API_KEY) {
    console.error("[GrupoIB Sync] BREVO_API_KEY ausente — e-mail de primeiro acesso não enviado.");
    return { status: "skipped", reason: "BREVO_API_KEY ausente" };
  }

  const { subject, html, text } = buildAccessEmail({ name: params.name, login: params.login, variant: params.variant });
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: parseAddress(BREVO_FROM),
          to: [parseAddress(params.to)],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) return { status: "sent", id: body?.messageId };

      lastError = `HTTP ${resp.status}: ${body?.message ?? body?.code ?? "erro desconhecido"}`;
      if (resp.status < 500) break;
    } catch (err) {
      lastError = String(err);
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 500));
  }

  console.error("[GrupoIB Sync] Falha ao enviar e-mail de primeiro acesso:", lastError);
  return { status: "failed", reason: lastError };
}

async function logAccessEmail(params: {
  profileId: string;
  sourceId: string;
  to: string;
  kind: AccessEmail["kind"];
  result: EmailResult;
}) {
  await admin.from("audit_log").insert({
    table_name: "profiles",
    row_id: params.profileId,
    action: params.result.status === "sent" ? "grupoib_sync_access_email_sent" : "grupoib_sync_access_email_failed",
    actor_id: null,
    clinic_id: CLINIC_ID,
    after: {
      source_id: params.sourceId,
      email: params.to,
      kind: params.kind,
      status: params.result.status,
      ...(params.result.status === "sent" ? { provider_id: params.result.id } : { reason: params.result.reason }),
    },
  });
}

function resolveRoleForEmployee(jobTitle?: string, department?: string) {
  const t = stripAccents(`${jobTitle ?? ""} ${department ?? ""}`).toLowerCase();
  if (/recep/.test(t)) return "recepcao";
  if (/financ|fatur/.test(t)) return "faturamento";
  if (/supervis/.test(t)) return "supervisor";
  if (/gerent|gestor|diretor|coordenad/.test(t)) return "gestor";
  if (/terap|psic|fono|fisiot|nutri|pedagog|musicoterap|odont|medic|enferm/.test(t)) return "terapeuta";
  return "recepcao";
}

Deno.serve(async (req: Request) => {
  if (!timingSafeEqual(req.headers.get("X-Webhook-Secret") ?? "", WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const payload = await req.json();
    const { table, record } = payload as { type: string; table: string; record: Record<string, unknown> };

    if (!record || record["unit_id"] !== TARGET_UNIT_ID) {
      return new Response(JSON.stringify({ skipped: true, reason: "unit_id fora do escopo" }), { status: 200 });
    }

    const isProfessional = table === "professionals";
    const eligible = isProfessional
      ? record["registration_status"] === "validated"
      : record["status"] === "ativo";

    const { data: existing } = await admin
      .from("profiles")
      .select("id, active")
      .eq("source_system", "grupo_ib")
      .eq("source_id", record["id"] as string)
      .maybeSingle();

    if (!eligible) {
      if (existing) {
        await admin.from("profiles").update({ active: false }).eq("id", existing.id);
        return new Response(JSON.stringify({ deactivated: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ skipped: true, reason: "nao elegivel" }), { status: 200 });
    }

    const professionText = (isProfessional ? record["profession"] : record["job_title"]) as string;
    const specialty = await matchDiscipline(professionText);
    const role = isProfessional ? "terapeuta" : resolveRoleForEmployee(record["job_title"] as string, record["department"] as string);
    const cpfDigits = normalizeCpf(record["cpf"]);
    const realEmail = (record["email"] as string | undefined) || undefined;

    const commonFields = {
      clinic_id: CLINIC_ID,
      role,
      full_name: record["name"] ?? null,
      council_type: record["council_type"] ?? null,
      council_number: record["council_number"] ?? null,
      council_uf: record["council_uf"] ?? null,
      council_validity: record["council_validity"] ?? null,
      phone: record["phone"] ?? null,
      // Se a origem parar de mandar CPF/e-mail numa atualização, não apaga o
      // que já está gravado (e em uso como login) — undefined some do
      // payload do update/insert. A criação abaixo grava o valor resolvido
      // (`cpfDigits`/`email`) explicitamente.
      cpf: cpfDigits ?? undefined,
      email: realEmail,
      photo_url: record["photo"] ?? null,
      discipline: specialty?.value ?? null,
      specialty_id: specialty?.id ?? null,
      active: true,
    };

    if (existing) {
      await admin.from("profiles").update(commonFields).eq("id", existing.id);
      return new Response(JSON.stringify({ updated: true, profile_id: existing.id }), { status: 200 });
    }

    // Sem e-mail real, o Supabase Auth ainda exige um endereço pra criar a
    // conta: geramos um sintético a partir do CPF — o colaborador nunca vê
    // isso, ele já loga com CPF + a senha aleatória abaixo (mesma ideia do
    // login por CPF da equipe e por telefone/OTP da família). Sem e-mail NEM
    // CPF válido não há como identificar essa pessoa de forma única — e sem
    // e-mail real também não há como avisá-la da senha (ver accessEmailStatus).
    if (!realEmail && !cpfDigits) {
      return new Response(JSON.stringify({ skipped: true, reason: "sem email nem cpf valido" }), { status: 200 });
    }
    const email = realEmail || `equipe_${cpfDigits}@staff.facaamigos.local`;
    // O que aparece no e-mail como "Login": quando há CPF, não imprime o
    // número (dado sensível — evita mandar CPF + senha juntos por e-mail),
    // só diz pra pessoa usar o próprio CPF. Sem CPF, mostra o e-mail mesmo
    // (é o endereço dela, não expõe nada novo).
    const loginDisplay = cpfDigits ? '"seu CPF"' : email;
    const fullName = (record["name"] as string) ?? "";

    const password = buildInitialPassword();

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { must_change_password: true, source: "grupo_ib" },
    });

    if (userError) {
      const alreadyExists = /already been registered|already exists/i.test(userError.message ?? "");
      if (alreadyExists) {
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users?.find((u) => u.email === email);
        if (found) {
          await admin.from("profiles").insert({
            id: found.id,
            source_system: "grupo_ib",
            source_id: record["id"],
            must_change_password: true,
            ...commonFields,
            cpf: cpfDigits,
            email,
          });
          // A conta já existia com senha própria (não sobrescrevemos a senha de
          // ninguém) — avisa que o acesso foi liberado, sem credencial no corpo.
          if (realEmail) {
            const emailResult = await sendAccessEmail({
              to: realEmail,
              login: loginDisplay,
              name: fullName,
              variant: { kind: "existing_account" },
            });
            await logAccessEmail({
              profileId: found.id,
              sourceId: record["id"] as string,
              to: realEmail,
              kind: "existing_account",
              result: emailResult,
            });
          }
          return new Response(JSON.stringify({ linked_existing_user: true, profile_id: found.id }), { status: 200 });
        }
      }
      throw userError;
    }

    await admin.from("profiles").insert({
      id: userData.user.id,
      source_system: "grupo_ib",
      source_id: record["id"],
      must_change_password: true,
      ...commonFields,
      cpf: cpfDigits,
      email,
    });

    let accessEmailStatus: EmailResult["status"] | "not_applicable" = "not_applicable";
    if (realEmail) {
      const emailResult = await sendAccessEmail({
        to: realEmail,
        login: loginDisplay,
        name: fullName,
        variant: { kind: "new_account", password },
      });
      accessEmailStatus = emailResult.status;
      await logAccessEmail({
        profileId: userData.user.id,
        sourceId: record["id"] as string,
        to: realEmail,
        kind: "new_account",
        result: emailResult,
      });
    }

    return new Response(
      JSON.stringify({ created: true, profile_id: userData.user.id, access_email: accessEmailStatus }),
      { status: 200 },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
