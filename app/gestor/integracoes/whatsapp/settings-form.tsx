"use client";

import { useState, useTransition } from "react";
import { updateWhatsappSettings } from "./whatsapp-settings-actions";

export function WhatsappSettingsForm({
  botEnabled,
  address,
  openingHours,
  humanContactPhone,
  evaluationSupervisorProfileId,
  evaluationDurationMinutes,
  supervisors,
}: {
  botEnabled: boolean;
  address: string;
  openingHours: string;
  humanContactPhone: string;
  evaluationSupervisorProfileId: string;
  evaluationDurationMinutes: number;
  supervisors: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateWhatsappSettings(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border border-[#cfc8b4] bg-white p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-bold flex items-center gap-2">🤖 Configuração do chatbot</h3>

      <label className="flex items-center justify-between cursor-pointer text-xs">
        <span className="text-[#57606b]">Bot ativo</span>
        <input type="checkbox" name="bot_enabled" defaultChecked={botEnabled} className="rounded border-[#cfc8b4]" />
      </label>

      <div className="space-y-1">
        <label className="text-xs text-[#57606b] block">Supervisor que faz a avaliação/anamnese</label>
        <select
          name="evaluation_supervisor_profile_id"
          defaultValue={evaluationSupervisorProfileId}
          className="w-full rounded-md border border-[#cfc8b4] bg-[#faf8f3] px-3 py-1.5 text-xs"
        >
          <option value="">Selecione…</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-[#57606b] block">Duração da avaliação (minutos)</label>
        <input
          type="number"
          name="evaluation_duration_minutes"
          defaultValue={evaluationDurationMinutes}
          className="w-full rounded-md border border-[#cfc8b4] bg-[#faf8f3] px-3 py-1.5 text-xs"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-[#57606b] block">Endereço</label>
        <input
          type="text"
          name="address"
          defaultValue={address}
          className="w-full rounded-md border border-[#cfc8b4] bg-[#faf8f3] px-3 py-1.5 text-xs"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-[#57606b] block">Horário de funcionamento</label>
        <input
          type="text"
          name="opening_hours"
          defaultValue={openingHours}
          className="w-full rounded-md border border-[#cfc8b4] bg-[#faf8f3] px-3 py-1.5 text-xs"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-[#57606b] block">Telefone humano (fallback)</label>
        <input
          type="text"
          name="human_contact_phone"
          defaultValue={humanContactPhone}
          className="w-full rounded-md border border-[#cfc8b4] bg-[#faf8f3] px-3 py-1.5 text-xs"
        />
      </div>

      <button type="submit" disabled={isPending} className="btn btn-primary text-xs w-full">
        {isPending ? "Salvando…" : "Salvar configurações"}
      </button>
      {saved && <p className="text-xs text-emerald-700">Configurações salvas.</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
