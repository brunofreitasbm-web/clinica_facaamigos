// Link real para /api/arquivos/documento/[id] (302 para a URL assinada) — não
// window.open depois de um await, que o navegador bloqueia como pop-up e era
// o motivo de "não consigo abrir o PDF". Ver lib/file-access-server.ts.
export function DocumentViewButton({ documentId, label = "Abrir" }: { documentId: string; label?: string }) {
  return (
    <a
      href={`/api/arquivos/documento/${documentId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-md border border-paper-line-strong px-3 py-1.5 text-xs text-ink hover:border-chart"
    >
      {label}
    </a>
  );
}
