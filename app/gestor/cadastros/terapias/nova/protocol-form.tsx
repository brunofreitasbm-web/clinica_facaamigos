"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PROTOCOL_CATALOG, PROTOCOL_AREAS } from "@/lib/protocol-catalog";
import { PROTOCOL_TEMPLATES, countTemplateItems } from "@/lib/protocol-templates";
import { createProtocol } from "./actions";

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

export function ProtocolForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"licensed" | "generic">("generic");
  const [selectedName, setSelectedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const entry = PROTOCOL_CATALOG.find((p) => p.name === selectedName);
  const template = selectedName ? PROTOCOL_TEMPLATES[selectedName] : undefined;
  const catalogForMode = useMemo(
    () => (mode === "generic" ? PROTOCOL_CATALOG.filter((p) => p.name in PROTOCOL_TEMPLATES) : PROTOCOL_CATALOG),
    [mode],
  );

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("mode", mode);
    startTransition(async () => {
      const result = await createProtocol(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(result.redirectTo ?? "/gestor/cadastros/protocolos");
    });
  }

  return (
    <form action={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Origem do protocolo</label>
        <div className="seg mt-1 w-fit" role="group" aria-label="Origem do protocolo">
          <button
            type="button"
            className="seg-btn"
            aria-pressed={mode === "generic"}
            onClick={() => {
              setMode("generic");
              setSelectedName("");
            }}
          >
            Estrutura genérica (sem licença)
          </button>
          <button
            type="button"
            className="seg-btn"
            aria-pressed={mode === "licensed"}
            onClick={() => {
              setMode("licensed");
              setSelectedName("");
            }}
          >
            Licenciado
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          {mode === "generic"
            ? "Semeia domínios, níveis e escala próprios do instrumento com itens de autoria original (ou reproduzidos com atribuição, quando de fonte aberta). Não é uma cópia do instrumento licenciado — ver docs/protocolos-genericos-fontes.md."
            : "Você digita os itens manualmente depois, a partir do material da licença que a clínica possui."}
        </p>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Protocolo</label>
        <select name="name" required value={selectedName} onChange={(e) => setSelectedName(e.target.value)} className={inputClass}>
          <option value="">Selecione…</option>
          {catalogForMode.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
            </option>
          ))}
        </select>
        {mode === "generic" && catalogForMode.length === 0 && (
          <p className="mt-1 text-xs text-status-negative-text">Nenhum template genérico disponível ainda.</p>
        )}
      </div>

      {mode === "generic" && template && (
        <div className="card bg-paper/60 text-xs text-ink-soft">
          <p className="m-0 font-medium text-ink">Resumo do template</p>
          <ul className="m-0 mt-1 list-disc pl-4">
            <li>
              {template.domains.length} domínios/níveis · {countTemplateItems(template)} itens
            </li>
            <li>
              Escala: 0–{template.scale.max} ({Object.values(template.scale.labels).join(" / ")})
            </li>
            <li>Conteúdo: {template.contentLicense === "cc-by" ? "reproduzido com atribuição (CC BY 4.0)" : "itens de autoria original"}</li>
          </ul>
          {template.attribution && <p className="m-0 mt-2 text-ink-faint">{template.attribution}</p>}
        </div>
      )}

      <input type="hidden" name="display_name" value={entry?.displayName ?? ""} />
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Área de avaliação</label>
        <select name="area" defaultValue={entry?.area ?? ""} className={inputClass} key={entry?.area ?? "none"}>
          <option value="">—</option>
          {PROTOCOL_AREAS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {mode === "licensed" && (
        <>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Versão (opcional)</label>
            <input name="version" className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-ink-soft">Licença comprada em (opcional)</label>
            <input type="date" name="license_purchased_at" className={inputClass} />
          </div>
        </>
      )}

      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="risk_accepted" className="mt-1" />
        <span>
          {mode === "generic"
            ? "Confirmo que esta é uma estrutura genérica (domínios, escala e itens de autoria própria ou de fonte aberta com atribuição), não uma reprodução do instrumento licenciado."
            : "Confirmo que a clínica possui licença de uso deste protocolo e assumo o risco de digitização das aplicações conforme a política jurídica da clínica."}
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={isPending || (mode === "generic" && !template)} className="btn btn-primary self-start">
          {isPending ? "Salvando…" : "Cadastrar protocolo"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </div>
    </form>
  );
}
