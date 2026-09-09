import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sincroniza profissionais PJ e funcionarios CLT da unidade "clinica-a" (Grupo IB)
// para o sistema CLINICA (tabela profiles / auth.users), na MESMA base Supabase.
// Disparado por trigger em public.professionals e public.employees.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("GRUPOIB_WEBHOOK_SECRET")!;

// Envio do e-mail de primeiro acesso (Resend). Sem RESEND_API_KEY a sincronizacao
// continua funcionando normalmente — so o e-mail e pulado (e registrado no
// audit_log), pra um secret faltando nunca derrubar o sync.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "FacaAmigos <nao-responda@facaamigos.com.br>";
const APP_LOGIN_URL = Deno.env.get("APP_LOGIN_URL") ?? "https://app.facaamigos.com.br/login";
const SUPPORT_CONTACT = Deno.env.get("SUPPORT_CONTACT") ?? "a recepcao da clinica";

const CLINIC_ID = "c0000000-0000-0000-0000-000000000001";
const TARGET_UNIT_ID = "clinica-a";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function stripAccents(s: string) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Senha inicial aleatoria (nao previsivel) — usuario e obrigado a troca-la no primeiro
// login via flag must_change_password.
function buildInitialPassword() {
  return crypto.randomUUID().replace(/-/g, "") + "Aa1!";
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

async function matchDiscipline(professionText: string): Promise<Specialty | null> {
  const specialties = await loadSpecialties();
  if (!specialties.length) return null;
  if (!professionText) return specialties.find((s) => s.value === "outro") ?? specialties[0];

  if (GEMINI_API_KEY) {
    try {
      const prompt =
        `Você recebe a profissão/cargo de um profissional de saúde: "${professionText}".\n` +
        `Lista de especialidades já cadastradas no formato value|label: ${
          specialties.map((s) => `${s.value}|${s.label}`).join("; ")
        }.\n` +
        `Responda SOMENTE com um JSON no formato {"match": "<value existente ou null>", "new_label": "<rótulo em português se não houver equivalente na lista, senão null>"}.`;

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );
      const json = await resp.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.match) {
          const found = specialties.find((s) => s.value === parsed.match);
          if (found) return found;
        }
        if (parsed.new_label) {
          const value = stripAccents(parsed.new_label)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
          const maxSort = Math.max(0, ...specialties.map((s) => s.sort_order ?? 0));
          const { data: created, error } = await admin
            .from("specialties")
            .insert({
              clinic_id: CLINIC_ID,
              value,
              label: parsed.new_label,
              sort_order: maxSort + 1,
              active: true,
            })
            .select("id, value, label")
            .single();
          if (!error && created) return created;
        }
      }
    } catch (err) {
      console.error("Gemini matching falhou, usando fallback por palavra-chave:", err);
    }
  }

  return keywordMatch(professionText, specialties) ?? specialties.find((s) => s.value === "outro") ?? null;
}

// Radicais em português cobrem variações de gênero/plural (ex: "psicólogo/a", "fisioterapeuta").
const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  psicologia_aba: ["psicolog", "psicoterap", "aba", "analista do comportamento"],
  fonoaudiologia: ["fono"],
  terapia_ocupacional: ["terapia ocupacional", "terapeuta ocupacional", " to "],
  fisioterapia: ["fisioterap"],
  musicoterapia: ["musicoterap"],
  psicopedagogia: ["psicopedagog"],
  nutricao: ["nutri"],
};

function keywordMatch(professionText: string, specialties: Specialty[]): Specialty | null {
  const normalized = ` ${stripAccents(professionText).toLowerCase()} `;

  for (const s of specialties) {
    const keywords = SPECIALTY_KEYWORDS[s.value];
    if (keywords?.some((k) => normalized.includes(stripAccents(k).toLowerCase()))) return s;
  }

  // Fallback genérico: rótulo cadastrado aparece dentro do texto, ou vice-versa
  // (cobre especialidades criadas dinamicamente, sem entrada no dicionário acima).
  return (
    specialties.find((s) => normalized.includes(stripAccents(s.label).toLowerCase())) ??
    specialties.find((s) => stripAccents(s.label).toLowerCase().includes(normalized.trim())) ??
    null
  );
}

// Papeis privilegiados (gestor/supervisor/faturamento) nunca sao auto-atribuidos: o
// funcionario entra com o papel minimo (recepcao) e o papel sugerido fica em
// pending_role para um gestor humano revisar e promover manualmente.
const PRIVILEGED_ROLES = new Set(["gestor", "supervisor", "faturamento"]);

function resolveRoleForEmployee(jobTitle?: string, department?: string): { role: string; pendingRole: string | null } {
  const t = stripAccents(`${jobTitle ?? ""} ${department ?? ""}`).toLowerCase();
  let suggested = "recepcao";
  if (/recep/.test(t)) suggested = "recepcao";
  else if (/financ|fatur/.test(t)) suggested = "faturamento";
  else if (/supervis/.test(t)) suggested = "supervisor";
  else if (/gerent|gestor|diretor|coordenad/.test(t)) suggested = "gestor";
  else if (/terap|psic|fono|fisiot|nutri|pedagog|musicoterap/.test(t)) suggested = "terapeuta";

  if (PRIVILEGED_ROLES.has(suggested)) {
    return { role: "recepcao", pendingRole: suggested };
  }
  return { role: suggested, pendingRole: null };
}

async function logPendingRoleReview(profileId: string, sourceId: string, pendingRole: string) {
  await admin.from("audit_log").insert({
    table_name: "profiles",
    row_id: profileId,
    action: "grupoib_sync_role_pending_review",
    actor_id: null,
    clinic_id: CLINIC_ID,
    after: { source_id: sourceId, pending_role: pendingRole },
  });
}

// ---------------------------------------------------------------------------
// E-mail de primeiro acesso (Resend)
// ---------------------------------------------------------------------------

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
       <p style="margin:8px 0 0">Use a mesma senha que você já utiliza com este e-mail. Se não lembrar, fale com ${
      escapeHtml(SUPPORT_CONTACT)
    }.</p>`;

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f7f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:20px;margin:0 0 16px;color:#f0196b">FaçaAmigos - Centro de Terapia Comportamental</h1>
    <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px">Seu cadastro chegou do sistema de gestão de pessoas do Grupo IB e sua conta no sistema da clínica já está pronta.</p>
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
    ? `${greeting}\n\nSeu cadastro chegou do sistema de gestão de pessoas do Grupo IB e sua conta no sistema da FaçaAmigos - Centro de Terapia Comportamental já está pronta.\n\nLogin: ${params.login}\nSenha inicial: ${
      (params.variant as { password: string }).password
    }\n\nAcesse: ${APP_LOGIN_URL}\n\nPor segurança, o sistema vai pedir que você troque essa senha no primeiro login. Não compartilhe estas credenciais com ninguém.\n\nDúvidas? Fale com ${SUPPORT_CONTACT}. Mensagem automática — não responda.`
    : `${greeting}\n\nSeu acesso ao sistema da FaçaAmigos - Centro de Terapia Comportamental foi liberado.\n\nLogin: ${params.login}\nUse a mesma senha que você já utiliza com este e-mail. Se não lembrar, fale com ${SUPPORT_CONTACT}.\n\nAcesse: ${APP_LOGIN_URL}\n\nMensagem automática — não responda.`;

  return { subject, html, text };
}

type EmailResult = { status: "sent"; id?: string } | { status: "skipped" | "failed"; reason: string };

/**
 * Envia via Resend com uma retentativa. Se falhar de vez numa conta recém-criada,
 * o profissional fica sem saber a senha (que não é recuperável daqui), então o
 * fracasso precisa ficar registrado no audit_log para alguém agir manualmente.
 */
async function sendAccessEmail(params: { to: string; name: string; variant: AccessEmail }): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    console.error("[GrupoIB Sync] RESEND_API_KEY ausente — e-mail de primeiro acesso não enviado.");
    return { status: "skipped", reason: "RESEND_API_KEY ausente" };
  }

  const { subject, html, text } = buildAccessEmail({ name: params.name, login: params.to, variant: params.variant });
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: RESEND_FROM, to: [params.to], subject, html, text }),
      });

      const body = await resp.json().catch(() => ({}));
      if (resp.ok) return { status: "sent", id: body?.id };

      lastError = `HTTP ${resp.status}: ${body?.message ?? body?.name ?? "erro desconhecido"}`;
      // 4xx (domínio não verificado, e-mail inválido) não melhora com retentativa.
      if (resp.status < 500) break;
    } catch (err) {
      lastError = String(err);
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 500));
  }

  console.error("[GrupoIB Sync] Falha ao enviar e-mail de primeiro acesso:", lastError);
  return { status: "failed", reason: lastError };
}

// Registra o resultado do envio sem NUNCA gravar a senha — o audit_log é lido por
// gestores dentro do app.
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

Deno.serve(async (req: Request) => {
  if (req.headers.get("X-Webhook-Secret") !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  try {
    const payload = await req.json();
    const { table, record } = payload as { type: string; table: string; record: Record<string, unknown> };

    if (!record || record["unit_id"] !== TARGET_UNIT_ID) {
      return new Response(JSON.stringify({ skipped: true, reason: "unit_id fora do escopo (só clinica-a)" }), { status: 200 });
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
      return new Response(JSON.stringify({ skipped: true, reason: "não elegível para sincronizar" }), { status: 200 });
    }

    const professionText = (isProfessional ? record["profession"] : record["job_title"]) as string;
    const specialty = await matchDiscipline(professionText);
    const { role, pendingRole } = isProfessional
      ? { role: "terapeuta", pendingRole: null as string | null }
      : resolveRoleForEmployee(record["job_title"] as string, record["department"] as string);

    const commonFields = {
      clinic_id: CLINIC_ID,
      role,
      pending_role: pendingRole,
      full_name: record["name"] ?? null,
      council_type: record["council_type"] ?? null,
      council_number: record["council_number"] ?? null,
      council_uf: record["council_uf"] ?? null,
      council_validity: record["council_validity"] ?? null,
      phone: record["phone"] ?? null,
      cpf: record["cpf"] ?? null,
      email: record["email"] ?? null,
      photo_url: record["photo"] ?? null,
      discipline: specialty?.value ?? null,
      specialty_id: specialty?.id ?? null,
      active: true,
    };

    // Atualização de um profissional já sincronizado: não há credencial nova a
    // comunicar (a senha em uso é a que ele mesmo definiu), então não envia e-mail.
    if (existing) {
      await admin.from("profiles").update(commonFields).eq("id", existing.id);
      if (pendingRole) await logPendingRoleReview(existing.id, record["id"] as string, pendingRole);
      return new Response(JSON.stringify({ updated: true, profile_id: existing.id, pending_role: pendingRole }), { status: 200 });
    }

    const email = record["email"] as string | undefined;
    if (!email) {
      return new Response(JSON.stringify({ skipped: true, reason: "sem email cadastrado" }), { status: 200 });
    }

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
          });
          if (pendingRole) await logPendingRoleReview(found.id, record["id"] as string, pendingRole);

          // A conta já existia com senha própria (não sobrescrevemos a senha de
          // ninguém) — avisa que o acesso foi liberado, sem credencial no corpo.
          const emailResult = await sendAccessEmail({ to: email, name: fullName, variant: { kind: "existing_account" } });
          await logAccessEmail({
            profileId: found.id,
            sourceId: record["id"] as string,
            to: email,
            kind: "existing_account",
            result: emailResult,
          });

          return new Response(
            JSON.stringify({
              linked_existing_user: true,
              profile_id: found.id,
              pending_role: pendingRole,
              access_email: emailResult.status,
            }),
            { status: 200 },
          );
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
    });

    if (pendingRole) await logPendingRoleReview(userData.user.id, record["id"] as string, pendingRole);

    const emailResult = await sendAccessEmail({ to: email, name: fullName, variant: { kind: "new_account", password } });
    await logAccessEmail({
      profileId: userData.user.id,
      sourceId: record["id"] as string,
      to: email,
      kind: "new_account",
      result: emailResult,
    });

    return new Response(
      JSON.stringify({
        created: true,
        profile_id: userData.user.id,
        pending_role: pendingRole,
        access_email: emailResult.status,
      }),
      { status: 200 },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
