import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buildAttentionItems, type AttentionCounts } from "@/lib/recepcao-attention-pure";

/**
 * Faixa no topo da home: o que precisa de ação agora, uma linha por assunto, cada
 * uma levando direto ao lugar de resolver. Substitui o antigo banner só de chegadas.
 * Em dia, vira uma linha discreta (não ocupa a tela).
 */
export function PrecisaDeVoce({ counts }: { counts: AttentionCounts }) {
  const items = buildAttentionItems(counts);

  if (items.length === 0) {
    return (
      <p className="mb-6 flex items-center gap-2 text-sm text-slate-500">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
        Tudo em dia: nada esperando por você agora.
      </p>
    );
  }

  return (
    <section aria-label="Precisa de você agora" className="mb-6 rounded-lg border border-slate-200 bg-white shadow-2xs">
      <h2 className="m-0 border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">
        Precisa de você agora
      </h2>
      <ul className="m-0 list-none divide-y divide-slate-100 p-0">
        {items.map((item, index) => (
          <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm text-slate-800">
              <strong className="tabular-nums">{item.count}</strong> {item.label.replace(/^\d+ /, "")}
            </span>
            <Link
              href={item.href}
              className={`inline-flex min-h-[36px] shrink-0 items-center rounded-full px-4 text-xs font-semibold no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                index === 0
                  ? "bg-teal-700 text-white hover:bg-teal-800"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.action}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
