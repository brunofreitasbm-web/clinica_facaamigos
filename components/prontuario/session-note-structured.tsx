import Link from "next/link";
import type { SessionNoteStructured } from "@/lib/session-note-fields";
import { FAMILY_GUIDANCE_LABEL, GOAL_RESULT_LABEL, getMetasTrabalhadas } from "@/lib/session-note-fields";
import type { BehaviorCatalogItem } from "@/lib/behavior-catalog";
import { behaviorLabel } from "@/lib/behavior-catalog";

/**
 * Renderização de uma versão de session_notes.structured — presença, metas
 * trabalhadas, comportamentos, orientações e texto livre. Usado no
 * histórico de evolução do terapeuta, na aba "Evolução" do prontuário
 * (recepção e ficha do terapeuta) — um único lugar pra não divergir o que
 * cada tela mostra do mesmo dado.
 */
export function SessionNoteStructuredView({
  structured,
  freeText,
  behaviorCatalog,
  goalDescriptionById,
  version,
  editJustification,
  historyHref,
}: {
  structured: SessionNoteStructured | null;
  freeText?: string | null;
  behaviorCatalog: BehaviorCatalogItem[];
  goalDescriptionById?: Map<string, string>;
  version?: number;
  editJustification?: string | null;
  historyHref?: string;
}) {
  const metas = getMetasTrabalhadas(structured);

  return (
    <div className="flex flex-col gap-1 text-sm text-ink">
      <span>Presença/engajamento: {structured?.presenca_engajamento ?? "—"}/5</span>
      <span>
        Metas trabalhadas:{" "}
        {metas.length > 0
          ? metas
              .map(
                (m) =>
                  `${goalDescriptionById?.get(m.plan_goal_id) ?? "— sem descrição (meta removida do plano)"} · ${
                    GOAL_RESULT_LABEL[m.resultado] ?? m.resultado
                  }`,
              )
              .join("; ")
          : "nenhuma registrada"}
      </span>
      <span>
        Comportamentos-alvo:{" "}
        {structured?.comportamentos?.length
          ? structured.comportamentos.map((c) => behaviorLabel(behaviorCatalog, c.tipo)).join(", ")
          : "nenhum registrado"}
      </span>
      <span>
        Orientações à família:{" "}
        {structured?.orientacoes?.length
          ? structured.orientacoes.map((o) => FAMILY_GUIDANCE_LABEL[o] ?? o).join(", ")
          : "nenhuma registrada"}
      </span>
      {editJustification && (
        <span>
          <span className="font-semibold">Motivo da edição: </span>
          {editJustification}
        </span>
      )}
      {freeText && <span className="italic text-ink-soft">&ldquo;{freeText}&rdquo;</span>}
      {version !== undefined && historyHref && (
        <Link href={historyHref} className="text-xs" style={{ color: "var(--color-accent)" }}>
          v{version} · ver histórico completo
        </Link>
      )}
    </div>
  );
}
