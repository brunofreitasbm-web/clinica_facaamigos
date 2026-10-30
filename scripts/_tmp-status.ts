// TEMPORÁRIO (não commitar): status de aprovação dos templates fa_clinica_* na Meta.
import fs from "fs";
import twilio from "twilio";

const ENV = "C:\\Users\\bruno\\Documents\\Projetos\\Clinica Faça Amigos\\.env.local";
for (const line of fs.readFileSync(ENV, "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
  const all = await client.content.v1.contents.list({ limit: 200 });
  for (const c of all.filter((x) => (x.friendlyName ?? "").startsWith("fa_clinica_"))) {
    let status = "sem pedido";
    try {
      const a = (await client.content.v1.contents(c.sid).approvalFetch().fetch()) as unknown as {
        whatsapp?: { status?: string; category?: string; rejection_reason?: string };
      };
      if (a.whatsapp) status = `${a.whatsapp.status} (${a.whatsapp.category})${a.whatsapp.rejection_reason ? " MOTIVO: " + a.whatsapp.rejection_reason : ""}`;
    } catch {
      /* sem pedido */
    }
    console.log(`${c.friendlyName} | ${c.sid} | ${status}`);
  }
}
main().catch((e) => {
  console.error("ERRO:", e?.message ?? e);
  process.exit(1);
});
