"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInteressadoAction } from "./actions";

export function InteressadoRapidoDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("Mãe");
  const [origin, setOrigin] = useState("Instagram");
  const [chiefComplaint, setChiefComplaint] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createInteressadoAction({
      fullName,
      birthDate,
      guardianName,
      guardianPhone,
      guardianRelationship,
      origin,
      chiefComplaint: chiefComplaint || undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Erro ao cadastrar interessado.");
      return;
    }

    // Limpar formulário e fechar modal
    setFullName("");
    setBirthDate("");
    setGuardianName("");
    setGuardianPhone("");
    setChiefComplaint("");
    setOpen(false);

    // O cadastro fica em `patients`/`guardians` na hora, mas a home da
    // recepção (fila de pendências, lista de pacientes) só reflete isso
    // depois de um refresh — sem isso o atendente via o modal fechar e
    // nada mudar na tela, parecia que o cadastro não tinha ido pra lugar
    // nenhum. Manda direto pra ficha do paciente recém-criado, mesma UX do
    // formulário completo (app/recepcao/pacientes/novo/page.tsx).
    if (res.patientId) {
      router.push(`/recepcao/pacientes/${res.patientId}`);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md px-3.5 py-2 text-xs font-semibold shadow-sm transition-all focus:outline-none"
        style={{
          background: "var(--color-accent-2-700, #4f46e5)",
          color: "#ffffff",
        }}
      >
        + Paciente sem avaliação
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg rounded-xl p-6 shadow-2xl transition-all"
            style={{ background: "var(--color-surface, #ffffff)", color: "var(--color-ink, #0f172a)" }}
          >
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h3 style={{ fontFamily: "var(--font-heading)" }} className="text-lg font-bold">
                  ⚡ Novo Paciente sem Avaliação (Cadastro Rápido - 30s)
                </h3>
                <p className="text-xs text-neutral-500">
                  Preencha apenas os dados essenciais para iniciar a jornada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700">
                  Nome da Criança / Paciente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Gabriel Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700">
                    Origem do Paciente
                  </label>
                  <select
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="Google">Google / Site</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Convênio">Convênio</option>
                    <option value="Passante / Presencial">Passante / Presencial</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700">
                    Nome do Responsável <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Maria Silva"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700">
                    Telefone / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="(11) 99999-9999"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700">
                  Queixa Principal / Motivo da Procura
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Suspeita de TEA, atraso na fala..."
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? "Salvando..." : "Cadastrar Paciente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
