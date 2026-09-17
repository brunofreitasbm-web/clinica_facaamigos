import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { fmtCurrency, fmtDateTime } from "@/lib/format";
import { formatReceiptNumber } from "@/lib/receipts";
import { FinanceiroSubnav } from "@/components/financeiro-subnav";
import { PageContainer } from "@/components/page-container";
import { ResendReceiptButton } from "./resend-receipt-button";

export const dynamic = "force-dynamic";

export default async function RecibosPage() {
  const supabase = await createClient();

  const { data: receiptRows } = await supabase
    .from("receipts")
    .select("id, number, year, description, amount, paid_at, sent_whatsapp_at, send_error, patients(full_name)")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("created_at", { ascending: false });

  const receipts = receiptRows ?? [];

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <FinanceiroSubnav activeTab="contratos" />

      <PageContainer>
        <div>
          <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
            Faturamento Particular
          </h6>
          <h1 className="m-0">Recibos de Pagamento</h1>
        </div>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          {receipts.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhum recibo emitido ainda.</p>
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Recibo</th>
                  <th>Paciente</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Pago em</th>
                  <th>WhatsApp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td className="tabular-figure font-semibold">{formatReceiptNumber(r.year, r.number)}</td>
                    <td>{(r.patients as { full_name: string } | null)?.full_name ?? "—"}</td>
                    <td className="text-xs">{r.description}</td>
                    <td className="tabular-figure">{fmtCurrency(Number(r.amount))}</td>
                    <td className="tabular-figure text-xs">{fmtDateTime(r.paid_at, CLINIC_TIMEZONE)}</td>
                    <td>
                      {r.sent_whatsapp_at ? (
                        <span className="tag-status st-realizada">Enviado</span>
                      ) : r.send_error ? (
                        <span className="tag-status st-falta" title={r.send_error}>
                          Falhou
                        </span>
                      ) : (
                        <span className="tag-status st-agendada">Pendente</span>
                      )}
                    </td>
                    <td className="text-right">
                      <ResendReceiptButton receiptId={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </PageContainer>
    </main>
  );
}
