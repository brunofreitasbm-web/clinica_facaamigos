"use client";

import { UserPlus, Phone, Calendar, HeartHandshake } from "lucide-react";
import type { ConversationRow } from "@/app/recepcao/atendimento/atendimento-shell";

interface ContactDetailsProps {
  conversation: ConversationRow;
  onOpenRegisterModal: () => void;
}

export function ContactDetails({ conversation, onOpenRegisterModal }: ContactDetailsProps) {
  return (
    <div className="flex h-full flex-col p-4 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-800 font-bold text-lg dark:bg-teal-950 dark:text-teal-200">
          {conversation.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100 text-sm">
            {conversation.displayName}
          </h3>
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Phone size={12} />
            <span>{conversation.phoneNumber}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3 flex-1 text-xs">
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Status da Conversa</span>
          <p className="text-slate-600 dark:text-slate-400 capitalize">
            {conversation.status === "open"
              ? "Em atendimento"
              : conversation.status === "pending"
              ? "Aguardando equipe"
              : "Encerrada"}
          </p>
        </div>

        {conversation.guardianName && (
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Responsável</span>
            <p className="text-slate-600 dark:text-slate-400">{conversation.guardianName}</p>
          </div>
        )}

        {conversation.kind === "lead" && (
          <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
            <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1 mb-1">
              <HeartHandshake size={14} /> Lead de Atendimento
            </span>
            <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
              Contato ainda não possui cadastro completo como paciente na clínica.
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onOpenRegisterModal}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600 transition-colors"
          title="Cadastrar interessado (Alt + C)"
        >
          <UserPlus size={15} />
          <span>Cadastrar Interessado</span>
          <kbd className="ml-auto rounded bg-teal-800 px-1.5 py-0.5 text-[10px] font-mono text-teal-100">
            Alt+C
          </kbd>
        </button>
      </div>
    </div>
  );
}
