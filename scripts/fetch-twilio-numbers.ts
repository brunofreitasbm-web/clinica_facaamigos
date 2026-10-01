import fs from "fs";
import path from "path";

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
} catch (e) {}

import { getTwilioClient } from "../lib/twilio";

async function main() {
  const client = getTwilioClient();
  if (!client) {
    console.error("Cliente Twilio nulo.");
    return;
  }

  try {
    const localBR = await client.availablePhoneNumbers("BR").local.list({ limit: 5 });
    console.log("Números locais BR disponíveis:");
    console.log(JSON.stringify(localBR, null, 2));
  } catch (err: any) {
    console.log("Erro BR local:", err.message);
  }

  try {
    const mobileBR = await client.availablePhoneNumbers("BR").mobile.list({ limit: 5 });
    console.log("Números móveis BR disponíveis:");
    console.log(JSON.stringify(mobileBR, null, 2));
  } catch (err: any) {
    console.log("Erro BR móvel:", err.message);
  }

  try {
    const localUS = await client.availablePhoneNumbers("US").local.list({ limit: 5 });
    console.log("Números locais US disponíveis:");
    console.log(JSON.stringify(localUS.map(n => n.phoneNumber), null, 2));
  } catch (err: any) {
    console.log("Erro US local:", err.message);
  }
}

main();
