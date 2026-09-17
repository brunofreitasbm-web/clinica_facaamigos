"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReceiptWhatsApp } from "@/lib/receipts";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Reenvia o recibo já gerado por WhatsApp — mesmo caminho de envio de
 * lib/receipts.ts::sendReceiptWhatsApp, usado tanto no primeiro envio
 * automático (ao confirmar pagamento) quanto neste reenvio manual.
 */
export async function resendReceiptAction(receiptId: string): Promise<ActionResult> {
  try {
    const admin = createAdminClient();
    await sendReceiptWhatsApp(admin, receiptId);
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Não foi possível reenviar o recibo." };
  }

  revalidatePath("/gestor/financeiro/recibos");
  return { success: true };
}
