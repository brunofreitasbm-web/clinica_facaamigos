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

import { getTwilioClient } from "../lib/twilio";

async function checkRecentFailures() {
  const client = getTwilioClient();
  if (!client) return;

  const messages = await client.messages.list({ limit: 5 });
  console.log("=== ÚLTIMOS ERROS TWILIO DETECTADOS ===");
  for (const m of messages) {
    if (m.status === "undelivered" || m.status === "failed") {
      console.log(`❌ Message SID: ${m.sid}`);
      console.log(`   Destino: ${m.to}`);
      console.log(`   Status: ${m.status}`);
      console.log(`   Código de Erro Twilio: ${m.errorCode}`);
      if (m.errorCode === 63016) {
        console.log(`   💡 Motivo: Regra da Meta/WhatsApp (Erro 63016): Tentativa de envio de mensagem de texto livre FORA da janela de 24 horas ativada pelo cliente.`);
      }
    }
  }
}

checkRecentFailures().catch(console.error);
