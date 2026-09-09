"use client";

import { useState } from "react";
import { createIntakeFormLink } from "./actions";

/**
 * Gera o link público da ficha (app/ficha/[token]) para mandar à família.
 *
 * A URL absoluta é montada aqui, no navegador: a action devolve só o caminho
 * porque o servidor não sabe por qual host o sistema está sendo acessado.
 */
export function IntakeFormLink({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setGerando(true);
    setErro(null);
    const resultado = await createIntakeFormLink(patientId);
    setGerando(false);

    if (resultado.success) {
      setUrl(`${window.location.origin}${resultado.path}`);
      setCopiado(false);
    } else {
      setErro(resultado.error);
    }
  }

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // Clipboard bloqueado (http, permissão negada): o link fica visível no
      // campo abaixo para cópia manual, então não vira erro de fluxo.
      setErro("Não consegui copiar automaticamente — selecione o link e copie.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
          Ficha pela família
        </h6>
        <p className="m-0 mt-1 text-[13px] text-ink-soft">
          Gera um link para a família de {patientName} preencher a ficha. Vale por 30 dias, serve uma
          vez só, e gerar um novo desativa o anterior.
        </p>
      </div>

      {erro && (
        <p role="alert" className="m-0 text-[13px] font-medium" style={{ color: "var(--color-accent-700)" }}>
          {erro}
        </p>
      )}

      {url ? (
        <div className="flex flex-col gap-2">
          <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link da ficha" />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={copiar}>
              {copiado ? "Copiado!" : "Copiar link"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={gerar} disabled={gerando}>
              Gerar outro
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary self-start" onClick={gerar} disabled={gerando}>
          {gerando ? "Gerando…" : "Gerar link da ficha"}
        </button>
      )}
    </div>
  );
}
