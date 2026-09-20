// lib/after-response.ts
// Agenda trabalho para DEPOIS de a resposta do webhook sair (`after` do Next),
// para não segurar a Twilio (~15s) com download/IA. `after` só existe dentro
// do escopo de uma requisição: em script, teste ou painel de teste sem
// requisição ele lança — aí apenas ignoramos (o cron de rascunhos e a
// reexecução manual cobrem o que ficou sem rodar).
import { after } from "next/server";

export function runAfterResponse(label: string, task: () => Promise<unknown>): boolean {
  try {
    after(async () => {
      try {
        await task();
      } catch (err) {
        console.error(`[After Response] ${label}:`, err);
      }
    });
    return true;
  } catch {
    return false;
  }
}
