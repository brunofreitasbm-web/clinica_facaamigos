"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copia texto para a área de transferência; sem a API moderna (http, navegador antigo), usa um textarea escondido. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // cai no método antigo abaixo
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Um dado do paciente em linha inteira (rótulo, valor e botão Copiar), para telefone e carteirinha
 * não quebrarem em colunas estreitas e irem direto para o portal do plano ou para o WhatsApp.
 */
export function IntakeCopyField({ label, value, copyValue }: { label: string; value: string | null; copyValue?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const onCopy = async () => {
    if (!value) return;
    const ok = await copyText(copyValue ?? value);
    setState(ok ? "copied" : "failed");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  };

  return (
    <div className="flex min-h-10 items-center gap-3 border-t border-slate-100 py-1 text-sm first:border-t-0">
      <span className="w-28 shrink-0 text-slate-600">{label}</span>
      <span className={`min-w-0 flex-1 break-words [overflow-wrap:anywhere] ${value ? "font-semibold text-slate-900" : "text-slate-500"}`}>
        {value ?? "Não informado"}
      </span>
      {value && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copiar ${label.toLowerCase()}`}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          {state === "copied" ? (
            <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          <span aria-live="polite">{state === "copied" ? "Copiado" : state === "failed" ? "Não copiou" : "Copiar"}</span>
        </button>
      )}
    </div>
  );
}
