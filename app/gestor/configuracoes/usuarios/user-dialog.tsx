"use client";

import { useState, useTransition } from "react";
import { createSystemUser, updateSystemUser } from "./actions";
import type { SystemUserRow, UserRole } from "./types";

interface UserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: SystemUserRow | null;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: "gestor", label: "Gestor", description: "Acesso total a relatórios, configurações e equipe." },
  { value: "recepcao", label: "Recepção", description: "Atendimento, agenda geral, cadastro e recepção de pacientes." },
  { value: "terapeuta", label: "Terapeuta", description: "Acesso à agenda própria, prontuário e evolução dos pacientes." },
  { value: "financeiro", label: "Financeiro", description: "Gestão de faturamento, convênios e repasse." },
  { value: "admin", label: "Administrador", description: "Controle total do sistema e infraestrutura." },
];

export function UserDialog({ isOpen, onClose, userToEdit }: UserDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState(userToEdit?.name ?? "");
  const [email, setEmail] = useState(userToEdit?.email ?? "");
  const [role, setRole] = useState<UserRole>(userToEdit?.role ?? "terapeuta");
  const [councilType, setCouncilType] = useState(userToEdit?.discipline ?? "");
  const [sendInvite, setSendInvite] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      try {
        if (userToEdit) {
          await updateSystemUser(userToEdit.id, {
            fullName,
            role,
            councilType,
          });
        } else {
          await createSystemUser({
            fullName,
            email,
            role,
            councilType,
          });
        }
        onClose();
      } catch (err: any) {
        setErrorMsg(err.message || "Ocorreu um erro ao salvar o usuário.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-paper-line bg-paper-panel p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-paper-line pb-4 mb-4">
          <h2 className="text-lg font-semibold text-ink-strong">
            {userToEdit ? `Editar Usuário: ${userToEdit.name}` : "Novo Usuário do Sistema"}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink-strong text-xl font-bold px-2 py-1 leading-none rounded"
          >
            &times;
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-strong">Nome Completo</label>
            <input
              type="text"
              required
              className="input"
              placeholder="Ex: Dra. Ana Paula Souza"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-strong">E-mail Institucional</label>
            <input
              type="email"
              required
              disabled={!!userToEdit}
              className="input disabled:bg-paper-line/30 disabled:cursor-not-allowed"
              placeholder="ana.souza@clinica.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-strong">Perfil de Acesso (Role)</label>
              <select
                className="input cursor-pointer"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-strong">Conselho / Especialidade</label>
              <input
                type="text"
                className="input"
                placeholder="Ex: CRP 06/123456"
                value={councilType}
                onChange={(e) => setCouncilType(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg bg-paper-line/30 p-3 text-xs text-ink-soft border border-paper-line">
            <span className="font-semibold text-ink-strong block mb-1">
              {ROLE_OPTIONS.find((r) => r.value === role)?.label}:
            </span>
            {ROLE_OPTIONS.find((r) => r.value === role)?.description}
          </div>

          {!userToEdit && (
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-paper-line text-accent"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
              />
              <span className="text-xs text-ink-strong">
                Enviar convite de acesso com link de criação de senha para o e-mail
              </span>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-paper-line mt-2">
            <button
              type="button"
              onClick={onClose}
              className="button button-outline"
              disabled={isPending}
            >
              Cancelar
            </button>
            <button type="submit" className="button button-primary" disabled={isPending}>
              {isPending ? "Salvando..." : userToEdit ? "Salvar Alterações" : "Criar Usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
