"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { saveCouponSettings } from "./actions";
import {
  buildCouponModel,
  SAMPLE_COUPON_INPUT,
  type CouponSettings,
  type CouponTriggerMode,
  type CouponPaperWidthMm,
} from "@/lib/checkin-coupon";
import { renderCouponBody } from "@/lib/checkin-coupon-html";
import { printCoupon } from "@/lib/print-coupon";

const TRIGGER_OPTIONS: { value: CouponTriggerMode; label: string; description: string }[] = [
  { value: "primeiro", label: "Primeiro check-in do dia", description: "Imprime só na primeira sessão do paciente naquele dia." },
  { value: "todos", label: "Todo check-in", description: "Imprime a cada check-in, mesmo se o paciente já tem cupom do dia." },
  { value: "manual", label: "Só manual", description: "Nunca imprime sozinho — só pelo botão \"Reimprimir cupom\" na agenda." },
];

const PAPER_WIDTH_OPTIONS: { value: CouponPaperWidthMm; label: string }[] = [
  { value: 80, label: "80mm" },
  { value: 58, label: "58mm" },
];

const FIELD_TOGGLES: { key: keyof CouponSettings; label: string }[] = [
  { key: "showLogo", label: "Logo da clínica" },
  { key: "showClinicName", label: "Nome da clínica" },
  { key: "showPatientName", label: "Nome do paciente" },
  { key: "showTicketLabel", label: "Senha / ticket do check-in" },
  { key: "showCheckinTime", label: "Hora do check-in" },
  { key: "showRoom", label: "Sala" },
  { key: "showDiscipline", label: "Especialidade / terapia" },
  { key: "showTherapist", label: "Terapeuta" },
  { key: "showTimeRange", label: "Horário de cada sessão" },
  { key: "showWarnings", label: "Avisos de convênio/autorização" },
  { key: "showPrintedAt", label: "\"Impresso em\" no rodapé" },
];

export function CupomManager({ settings }: { settings: CouponSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<CouponSettings>(settings);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const previewModel = useMemo(() => buildCouponModel(SAMPLE_COUPON_INPUT, form), [form]);
  const previewHtml = useMemo(() => renderCouponBody(previewModel), [previewModel]);

  function toggleField(key: keyof CouponSettings) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveCouponSettings(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="enabled"
            checked={form.enabled}
            onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
            className="h-4 w-4"
          />
          Impressão automática ativada
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Gatilho</legend>
          {TRIGGER_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="trigger_mode"
                value={opt.value}
                checked={form.triggerMode === opt.value}
                onChange={() => setForm((p) => ({ ...p, triggerMode: opt.value }))}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-ink">{opt.label}</span>
                <span className="block text-xs text-ink-faint">{opt.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Largura do papel</legend>
          <div className="flex gap-4">
            {PAPER_WIDTH_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paper_width_mm"
                  value={opt.value}
                  checked={form.paperWidthMm === opt.value}
                  onChange={() => setForm((p) => ({ ...p, paperWidthMm: opt.value }))}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Cabeçalho (texto livre, aparece abaixo da logo)
          <textarea
            name="header_text"
            rows={2}
            maxLength={200}
            className="input"
            value={form.headerText}
            onChange={(e) => setForm((p) => ({ ...p, headerText: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Rodapé (texto livre, antes de &quot;Impresso em&quot;)
          <textarea
            name="footer_text"
            rows={2}
            maxLength={200}
            className="input"
            value={form.footerText}
            onChange={(e) => setForm((p) => ({ ...p, footerText: e.target.value }))}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Campos do cupom</legend>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {FIELD_TOGGLES.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={f.key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}
                  checked={Boolean(form[f.key])}
                  onChange={() => toggleField(f.key)}
                  className="h-4 w-4"
                />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-xs text-status-negative-text">{error}</p>}

        <div>
          <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
            {isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>

        <details className="rounded-md border border-paper-line-strong bg-paper/60 p-3 text-xs text-ink-soft">
          <summary className="cursor-pointer font-semibold text-ink">Como imprimir sem a caixa de diálogo</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Defina a impressora térmica como impressora padrão do Windows.</li>
            <li>No driver da impressora, defina o papel como 80mm × recibo/rolo (não A4).</li>
            <li>
              Clique em &quot;Imprimir teste&quot; abaixo; no diálogo do navegador, escolha Margens = Nenhuma e desmarque
              Cabeçalhos e rodapés — o navegador memoriza essa escolha.
            </li>
            <li>
              Crie um atalho dedicado do Chrome com{" "}
              <code>--kiosk-printing --user-data-dir=&quot;C:\ChromeRecepcao&quot;</code> e use o sistema só por ele — assim
              a impressão sai sem diálogo nenhum.
            </li>
          </ol>
        </details>
      </form>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Prévia (dados de exemplo)</p>
        <div
          className="mx-auto rounded border border-paper-line-strong bg-white p-3 shadow-sm"
          style={{
            width: `${form.paperWidthMm}mm`,
            fontFamily: '"Courier New", ui-monospace, monospace',
            fontSize: form.paperWidthMm === 80 ? 12 : 11,
            color: "#000",
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
        <button
          type="button"
          onClick={() => printCoupon(previewModel)}
          className="btn btn-secondary flex w-fit items-center gap-2"
        >
          <Printer size={15} /> Imprimir teste
        </button>
        <p className="text-[11px] text-ink-faint">
          O teste imprime com os valores atuais do formulário, mesmo sem salvar.
        </p>
      </div>
    </div>
  );
}
