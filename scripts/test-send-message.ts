import fs from "fs";
import path from "path";

// Carregar .env.local nativamente
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let value = trimmed.slice(eqIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
} catch (e) {
  console.warn("Erro ao ler .env.local:", e);
}

import { isTwilioConfigured, getTwilioClient } from "../lib/twilio";

async function main() {
  console.log("=== DIAGNÓSTICO E VERIFICAÇÃO TWILIO ===");
  console.log("1. Configurado no ambiente:", isTwilioConfigured());
  console.log("   Account SID:", process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.slice(0, 8)}...` : "NÃO CONFIGURADO");
  console.log("   WhatsApp Number:", process.env.TWILIO_WHATSAPP_NUMBER || "NÃO CONFIGURADO");
  console.log("   Phone Number:", process.env.TWILIO_PHONE_NUMBER || "NÃO CONFIGURADO");
  
  const client = getTwilioClient();
  if (!client) {
    console.error("❌ Falha ao obter cliente Twilio.");
    process.exit(1);
  }

  try {
    console.log("\n2. Testando autenticação com a API da Twilio...");
    const account = await client.api.v2010.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
    console.log("✅ Conexão estabelecida com sucesso!");
    console.log("   Nome da Conta:", account.friendlyName);
    console.log("   Status da Conta:", account.status);
    console.log("   Tipo de Conta:", account.type);

    console.log("\n3. Consultando os últimos disparos de mensagem na Twilio...");
    const messages = await client.messages.list({ limit: 10 });
    if (messages.length === 0) {
      console.log("⚠️ Nenhuma mensagem encontrada nos logs recentes da Twilio.");
    } else {
      console.log(`📋 Encontradas ${messages.length} mensagens recentes:`);
      for (const msg of messages) {
        console.log(`- SID: ${msg.sid} | Para: ${msg.to} | De: ${msg.from} | Status: ${msg.status} | Código Erro: ${msg.errorCode ?? "Nenhum"} | Mensagem Erro: ${msg.errorMessage ?? "Nenhuma"}`);
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Erro ao comunicar com a Twilio:", errorMsg);
  }
}

main().catch(console.error);
