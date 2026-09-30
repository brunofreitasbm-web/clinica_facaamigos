import { ArrowDownLeft, Bot, CheckCheck, Megaphone } from "lucide-react";
import type { LastMessageSender } from "@/lib/atendimento/types";

/**
 * Sinalizador de quem mandou a última mensagem, na linha de prévia da fila de
 * Atendimento (desktop e PWA). "Cliente" é o único estado que pede ação —
 * por isso é a única pílula colorida; os demais são um prefixo discreto.
 */
export function LastSenderIndicator({ sender }: { sender: LastMessageSender | null }) {
  if (!sender) return null;

  if (sender === "contact") {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        title="Última mensagem enviada pelo cliente"
        aria-label="Última mensagem enviada pelo cliente"
      >
        <ArrowDownLeft size={11} strokeWidth={2.5} aria-hidden />
        Cliente
      </span>
    );
  }

  const config = {
    agent: {
      Icon: CheckCheck,
      // `messages` não guarda QUEM da equipe enviou — "Você" seria chute.
      label: "Equipe",
      title: "Última mensagem enviada pela equipe",
      className: "text-teal-700 dark:text-teal-400",
    },
    bot: {
      Icon: Bot,
      label: "Bot",
      title: "Última mensagem enviada pelo bot",
      className: "text-slate-500 dark:text-slate-400",
    },
    automation: {
      Icon: Megaphone,
      label: "Auto",
      title: "Última mensagem foi um aviso automático",
      className: "text-slate-500 dark:text-slate-400",
    },
  }[sender];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 font-semibold ${config.className}`}
      title={config.title}
      aria-label={config.title}
    >
      <config.Icon size={13} aria-hidden />
      {config.label}:
    </span>
  );
}
