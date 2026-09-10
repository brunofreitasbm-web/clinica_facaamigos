import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PROTOCOL_LABEL } from "@/app/gestor/cadastros/data";
import { getProtocolScale } from "@/lib/protocol-assessments";
import { ProtocolItemForm } from "./protocol-item-form";
import { ProtocolImportForm } from "./protocol-import-form";
import { deleteProtocolItem } from "./actions";
import { PageContainer } from "@/components/page-container";

export const dynamic = "force-dynamic";

export default async function ProtocoloItensPage({
  params,
}: {
  params: Promise<{ protocolId: string }>;
}) {
  const { protocolId } = await params;
  const supabase = await createClient();

  const { data: protocol, error: protocolError } = await supabase
    .from("protocols")
    .select("id, name, version, is_generic, scale")
    .eq("id", protocolId)
    .maybeSingle();

  if (!protocol || protocolError) notFound();

  const { data: itemsRaw } = await supabase
    .from("protocol_items")
    .select("id, domain, level, item_code, description")
    .eq("protocol_id", protocolId)
    .order("sort_order")
    .order("domain")
    .order("level")
    .order("item_code");

  const items = itemsRaw ?? [];
  const domains = [...new Set(items.map((i) => i.domain))];
  const scale = getProtocolScale(protocol.scale);

  return (
    <PageContainer>
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
          <Link href="/gestor/cadastros/protocolos">Protocolos</Link>
        </h6>
        <h1 className="m-0">
          {PROTOCOL_LABEL[protocol.name] ?? protocol.name}
          {protocol.version ? ` — v${protocol.version}` : ""}
        </h1>
        <p className="text-sm text-ink-faint">
          {protocol.is_generic ? "Estrutura genérica (sem licença)" : "Protocolo licenciado"} · Escala 0–{scale.max} (
          {Object.values(scale.labels).join(" / ")})
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-start gap-4">
          <ProtocolItemForm protocolId={protocol.id} />
        </div>
        <ProtocolImportForm protocolId={protocol.id} />

        {domains.length === 0 && (
          <p className="text-sm text-ink-faint">Nenhum item cadastrado ainda para este protocolo.</p>
        )}

        {domains.map((domain) => (
          <section key={domain}>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
              {domain}
            </h6>
            <table className="table">
              <thead>
                <tr>
                  <th>Nível</th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((i) => i.domain === domain)
                  .map((item) => (
                    <tr key={item.id}>
                      <td>{item.level ?? "—"}</td>
                      <td className="font-semibold">{item.item_code}</td>
                      <td>{item.description}</td>
                      <td className="text-right">
                        <form
                          action={async () => {
                            "use server";
                            await deleteProtocolItem(protocol.id, item.id);
                          }}
                        >
                          <button type="submit" className="btn btn-ghost text-xs">
                            Remover
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
