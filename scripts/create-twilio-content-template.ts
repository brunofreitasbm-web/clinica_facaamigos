import fs from "fs";
import path from "path";
import twilio from "twilio";

// Carregar .env.local nativamente
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
      process.env[key] = val;
    }
  }
}

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error("ERRO: TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN não estão definidos no .env.local");
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function main() {
  console.log("Conectando à API da Twilio...");
  console.log(`Account SID: ${accountSid}`);

  try {
    // 1. Listar templates existentes na Content API
    const existingContents = await client.content.v1.contents.list({ limit: 20 });
    console.log(`Templates existentes encontrados na conta Twilio: ${existingContents.length}`);
    for (const c of existingContents) {
      console.log(`- SID: ${c.sid} | Nome: ${c.friendlyName} | Idioma: ${c.language}`);
    }

    // 2. Criar Novo Template de Assinatura de Termo via Content API
    const friendlyName = `termo_assinatura_digital_${Date.now().toString().slice(-4)}`;
    console.log(`\nCriando novo template via Twilio Content API: "${friendlyName}"...`);

    const newContent = await client.content.v1.contents.create({
      friendlyName,
      language: "pt_BR",
      variables: {
        "1": "Nome do Responsável",
        "2": "Nome do Paciente / Termo",
        "3": "Link Seguro"
      },
      types: {
        "twilio/text": {
          body: "Olá, {{1}}! O documento/termo de {{2}} está disponível para sua leitura e assinatura eletrônica na Clínica Faça Amigos. Acesse o link seguro para assinar via celular: {{3}}"
        }
      }
    });

    console.log("\n✅ Template de mensagem gerado e registrado com sucesso na Twilio via API!");
    console.log(`Content SID Gerado: ${newContent.sid}`);
    console.log(`Instância de Linguagem: ${newContent.language}`);
    console.log("\nAtualize o seu arquivo .env.local com:");
    console.log(`TWILIO_ANAMNESIS_TEMPLATE_CONTENT_SID=${newContent.sid}`);

  } catch (error: any) {
    console.error("Erro ao interagir com a Twilio Content API:", error.message || error);
    if (error.code) {
      console.error(`Código de Erro Twilio: ${error.code}`);
    }
  }
}

main();
