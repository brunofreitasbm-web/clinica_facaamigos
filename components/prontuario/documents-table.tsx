// components/prontuario/documents-table.tsx
//
// Tabela da aba "Documentos" do prontuário — uma só para a ficha da recepção,
// a gestão do paciente, a ficha do terapeuta e o prontuário unificado da
// supervisão. Mostra o que foi de fato enviado (nome do arquivo, tipo, origem
// WhatsApp/Portal) e abre o arquivo por link real (DocumentViewButton).
import type { DocumentRow } from "@/lib/patient-dossier";
import { DOCUMENT_CATEGORY_LABEL, getValidityBadge } from "@/lib/document-categories";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { DocumentViewButton } from "@/components/prontuario/document-view-button";

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  whatsapp: { label: "WhatsApp", className: "bg-status-positive-soft text-status-positive-text" },
  portal: { label: "Portal", className: "bg-status-neutral-soft text-status-neutral-text" },
};

/** "PDF" / "Foto" pelo mime; null quando não há mime (documentos antigos) ou é um tipo que não sabemos nomear. */
function fileKindLabel(mimeType: string | null): string | null {
  if (!mimeType) return null;
  const mime = mimeType.toLowerCase();
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "Foto";
  return null;
}

export function DocumentsTable({
  documents,
  emptyMessage = "Nenhum documento anexado ainda.",
}: {
  documents: DocumentRow[];
  emptyMessage?: string;
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Documento</th>
          <th>Tipo</th>
          <th>Data e hora</th>
          <th>Visível à família</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => {
          const validityBadge = getValidityBadge(doc.validUntil);
          const source = doc.source ? SOURCE_BADGE[doc.source] : undefined;
          const kind = fileKindLabel(doc.mimeType);
          return (
            <tr key={doc.id}>
              <td>
                <span className="font-semibold">{DOCUMENT_CATEGORY_LABEL[doc.category] ?? doc.category}</span>
                {validityBadge && (
                  <span className={`tag-status ml-2 ${validityBadge.label === "Vencido" ? "st-falta" : "st-agendada"}`}>
                    {validityBadge.label}
                  </span>
                )}
                {source && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${source.className}`}>
                    {source.label}
                  </span>
                )}
                {doc.originalName && <p className="mt-0.5 break-all text-xs text-ink-soft">{doc.originalName}</p>}
                {doc.note && <p className="mt-0.5 text-xs text-ink-faint">{doc.note}</p>}
              </td>
              <td>{kind ?? <span className="text-ink-faint">—</span>}</td>
              <td>
                {fmtDateTime(doc.uploadedAt, CLINIC_TIMEZONE)}
                {doc.validUntil && ` · válido até ${fmtDate(`${doc.validUntil}T00:00:00`, CLINIC_TIMEZONE)}`}
              </td>
              <td>{doc.sharedWithFamily ? "Sim" : "Não"}</td>
              <td className="text-right">
                <DocumentViewButton documentId={doc.id} />
              </td>
            </tr>
          );
        })}
        {documents.length === 0 && (
          <tr>
            <td colSpan={5} className="text-ink-faint">
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
