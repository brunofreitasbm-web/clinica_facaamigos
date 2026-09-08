"use client";

import { useState, useTransition } from "react";
import { createStaff, updateStaffProfile } from "./actions";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import { useToast } from "@/components/toast-provider";
import type { StaffRow } from "./types";

interface StaffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  staffToEdit?: StaffRow | null;
}

export function StaffDialog({ isOpen, onClose, staffToEdit }: StaffDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [fullName, setFullName] = useState(staffToEdit?.fullName ?? "");
  const [role, setRole] = useState<Role>(staffToEdit?.role ?? "terapeuta");
  const [councilType, setCouncilType] = useState(staffToEdit?.councilType ?? "");
  const [isEvaluator, setIsEvaluator] = useState(staffToEdit?.isEvaluator ?? false);

  if (!isOpen) return null;

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = staffToEdit
        ? await updateStaffProfile(staffToEdit.id, { fullName, role, councilType, isEvaluator })
        : await createStaff(formData);

      if (!result.success) {
        setError(result.error);
        toast(result.error, "error");
        return;
      }
      toast(staffToEdit ? "Colaborador atualizado." : "Conta de usuário criada com sucesso!", "success");
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-paper-line pb-4 mb-4">
          <h2 className="text-lg font-semibold text-ink-strong">
            {staffToEdit ? `Editar colaborador: ${staffToEdit.fullName}` : "Novo colaborador"}
          </h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-strong text-xl font-bold px-2 py-1 leading-none rounded">
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        )}

        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-strong" htmlFor="full_name">Nome completo</label>
            <input
              id="full_name"
              name="full_name"
              required
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {!staffToEdit && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" required className="input" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="password">Senha inicial</label>
                <input id="password" name="password" type="text" minLength={8} required className="input" />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-strong" htmlFor="role">Papel</label>
              <select
                id="role"
                name="role"
                required
                className="input cursor-pointer"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-strong" htmlFor="council_type">Conselho / especialidade</label>
              <input
                id="council_type"
                name="council_type"
                className="input"
                placeholder="Ex: CRP 06/123456"
                value={councilType}
                onChange={(e) => setCouncilType(e.target.value)}
              />
            </div>
          </div>

          {role === "terapeuta" && (
            <label className="flex items-center gap-2 text-sm text-ink-strong">
              <input
                type="checkbox"
                name="is_evaluator"
                checked={isEvaluator}
                onChange={(e) => setIsEvaluator(e.target.checked)}
              />
              É avaliador — aparece no agendamento de 1ª avaliação
            </label>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-paper-line mt-2">
            <button type="button" onClick={onClose} className="button button-outline" disabled={isPending}>
              Cancelar
            </button>
            <button type="submit" className="button button-primary" disabled={isPending}>
              {isPending ? "Salvando…" : staffToEdit ? "Salvar alterações" : "Criar conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
