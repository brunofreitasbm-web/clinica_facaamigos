"use client";

import { useState, useTransition } from "react";
import { createStaff, updateStaffProfile } from "./actions";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import { useToast } from "@/components/toast-provider";
import { formatCpfMask } from "@/lib/masks";
import { PasswordStrengthChecklist } from "@/components/password-strength-checklist";
import { PASSWORD_MIN_LENGTH, isPasswordStrong } from "@/lib/password";
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
  const [cpf, setCpf] = useState(staffToEdit?.cpf ? formatCpfMask(staffToEdit.cpf) : "");
  const [role, setRole] = useState<Role>(staffToEdit?.role ?? "terapeuta");
  const [councilType, setCouncilType] = useState(staffToEdit?.councilType ?? "");
  const [isEvaluator, setIsEvaluator] = useState(staffToEdit?.isEvaluator ?? false);
  const [isAtProfessional, setIsAtProfessional] = useState(staffToEdit?.isAtProfessional ?? false);
  const [googleCalendarOptIn, setGoogleCalendarOptIn] = useState(staffToEdit?.googleCalendarOptIn ?? false);
  const [birthDate, setBirthDate] = useState(staffToEdit?.birthDate ?? "");
  const [password, setPassword] = useState("");

  if (!isOpen) return null;

  const fromGrupoIb = staffToEdit?.sourceSystem === "grupo_ib";

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = staffToEdit
        ? await updateStaffProfile(staffToEdit.id, {
            fullName,
            cpf,
            role,
            councilType,
            isEvaluator,
            isAtProfessional,
            googleCalendarOptIn,
            birthDate,
          })
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
          <h2 className="m-0 text-lg font-semibold text-ink-strong">
            {staffToEdit ? `Editar colaborador: ${staffToEdit.fullName}` : "Novo colaborador"}
          </h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink-strong text-xl font-bold px-2 py-1 leading-none rounded">
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
        )}

        {fromGrupoIb && (
          <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
            Cadastro sincronizado do sistema de gestão de pessoas do Grupo IB. Alterações feitas aqui
            são sobrescritas na próxima atualização do cadastro lá — corrija na origem sempre que
            possível.
          </div>
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

          {staffToEdit ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="cpf">CPF (login)</label>
                <input
                  id="cpf"
                  name="cpf"
                  className="input"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfMask(e.target.value))}
                />
                <span className="text-[11px] text-ink-faint">
                  {staffToEdit.cpf
                    ? "Colaborador entra com este CPF + a senha."
                    : "Sem CPF cadastrado ainda — o colaborador continua entrando com e-mail até preencher aqui."}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">E-mail de acesso</label>
                {/* O e-mail é o endereço real no Supabase Auth (pode ser sintético
                    quando não há e-mail de verdade): trocar aqui dessincronizaria
                    profiles de auth.users, então a edição fica só de leitura. */}
                <input className="input" value={staffToEdit.email ?? "—"} disabled readOnly />
                <span className="text-[11px] text-ink-faint">
                  Para trocar o e-mail associado à conta, fale com o time técnico.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="cpf">CPF</label>
                <input
                  id="cpf"
                  name="cpf"
                  required
                  className="input"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfMask(e.target.value))}
                />
                <span className="text-[11px] text-ink-faint">É o que o colaborador digita pra entrar.</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="email">
                  E-mail <span className="text-ink-faint font-normal">(opcional)</span>
                </label>
                <input id="email" name="email" type="email" className="input" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong" htmlFor="password">Senha inicial</label>
                <input
                  id="password"
                  name="password"
                  type="text"
                  minLength={PASSWORD_MIN_LENGTH}
                  required
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordStrengthChecklist password={password} />
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-strong" htmlFor="birth_date">
              Data de aniversário
            </label>
            <input
              id="birth_date"
              name="birth_date"
              type="date"
              className="input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
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

          {role === "terapeuta" && (
            <label className="flex items-center gap-2 text-sm text-ink-strong">
              <input
                type="checkbox"
                name="is_at_professional"
                checked={isAtProfessional}
                onChange={(e) => setIsAtProfessional(e.target.checked)}
              />
              Atua em Acompanhamento Terapêutico (AT) — abre o módulo /at
            </label>
          )}

          {staffToEdit && (() => {
            const hasRealEmail = !!staffToEdit.email && !staffToEdit.email.endsWith("@staff.facaamigos.local");
            return (
              <label className="flex items-start gap-2 text-sm text-ink-strong">
                <input
                  type="checkbox"
                  checked={googleCalendarOptIn}
                  disabled={!hasRealEmail}
                  onChange={(e) => setGoogleCalendarOptIn(e.target.checked)}
                />
                <span>
                  Enviar convites do Google Calendar para os atendimentos deste profissional
                  <br />
                  <span className="text-[11px] text-ink-faint">
                    {hasRealEmail
                      ? "O profissional recebe um convite de agenda por e-mail a cada atendimento marcado, reagendado ou cancelado."
                      : "Requer e-mail real cadastrado — sem e-mail não há como enviar o convite."}
                  </span>
                </span>
              </label>
            );
          })()}

          <div className="flex justify-end gap-3 pt-4 border-t border-paper-line mt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isPending}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending || (!staffToEdit && !isPasswordStrong(password))}
            >
              {isPending ? "Salvando…" : staffToEdit ? "Salvar alterações" : "Criar conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
