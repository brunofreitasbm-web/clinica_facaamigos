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

async function diagnoseSender() {
  const client = getTwilioClient();
  if (!client) {
    console.error("Cliente Twilio nulo.");
    return;
  }

  console.log("=== DIAGNÓSTICO PROFUNDO DO REMETENTE E ENVIOS TWILIO ===");

  // 1. Verificar telefones cadastrados na conta
  try {
    const numbers = await client.incomingPhoneNumbers.list({ limit: 10 });
    console.log(`\n1. Números de Telefone comprados na Twilio (${numbers.length}):`);
    for (const n of numbers) {
      console.log(`   - SID: ${n.sid} | Número: ${n.phoneNumber} | Nome: ${n.friendlyName}`);
    }
  } catch (err) {
    console.error("Erro ao listar números de telefone:", err);
  }

  // 2. Verificar os últimos 5 disparos efetuados
  try {
    const messages = await client.messages.list({ limit: 5 });
    console.log(`\n2. Detalhes dos últimos ${messages.length} disparos:`);
    for (const msg of messages) {
      console.log(`--------------------------------------------------`);
      console.log(`Message SID: ${msg.sid}`);
      console.log(`De (From): ${msg.from}`);
      console.log(`Para (To): ${msg.to}`);
      console.log(`Texto: "${msg.body}"`);
      console.log(`Status Atual: ${msg.status}`);
      console.log(`Código de Erro: ${msg.errorCode ?? "Nenhum"}`);
      console.log(`Mensagem de Erro: ${msg.errorMessage ?? "Nenhuma"}`);
      console.log(`Data de Criação: ${msg.dateCreated}`);
      console.log(`Data de Envio: ${msg.dateSent}`);
    }
  } catch (err) {
    console.error("Erro ao buscar mensagens:", err);
  }
}

diagnoseSender().catch(console.error);
