"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Bot, History, Settings2, ArrowLeft } from "lucide-react";

const NAV_ITEMS = [
  {
    key: "validacao",
    label: "Validação de Documentos",
    href: "/whatsapp-bot/validacao-documentos",
    icon: ShieldCheck,
  },
  {
    key: "agendamento",
    label: "Chatbot & Agendamento",
    href: "/whatsapp-bot/agendamento-autonomo",
    icon: Bot,
  },
  {
    key: "historico",
    label: "Histórico & Disparos",
    href: "/whatsapp-bot/mensagens-historico",
    icon: History,
  },
  {
    key: "configuracoes",
    label: "Configurações & Twilio API",
    href: "/whatsapp-bot/configuracoes-api",
    icon: Settings2,
  },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

export function WhatsappBotNav() {
  const pathname = usePathname();

  const getActiveKey = (): NavKey => {
    if (pathname?.includes("/agendamento-autonomo")) return "agendamento";
    if (pathname?.includes("/mensagens-historico")) return "historico";
    if (pathname?.includes("/configuracoes-api")) return "configuracoes";
    return "validacao";
  };

  const activeKey = getActiveKey();

  return (
    <div className="sticky top-0 z-20 print:hidden border-b border-emerald-950/40 bg-slate-950 shadow-md">
      <header className="flex h-16 items-center justify-between px-6 sm:px-10">
        <div className="flex items-center gap-4">
          <Link
            href="/gestor"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition py-1 px-2.5 rounded-lg bg-slate-900 border border-slate-800"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao Gestor</span>
          </Link>

          <div className="h-5 w-px bg-slate-800" />

          <Link href="/whatsapp-bot" className="flex items-center gap-2.5 no-underline">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white tracking-tight">
                Validação de Documentos (WhatsApp Bot)
              </span>
              <span className="text-[11px] text-teal-400 font-medium">
                Faça Amigos · Automações & Anamnese
              </span>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-1.5 lg:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isCurrent = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold no-underline transition-all ${
                  isCurrent
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon size={15} className={isCurrent ? "text-teal-400" : "text-slate-400"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Mobile nav */}
      <nav className="flex w-full flex-wrap gap-1 border-t border-slate-900 px-6 py-2 lg:hidden bg-slate-950">
        {NAV_ITEMS.map((item) => {
          const isCurrent = activeKey === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold no-underline ${
                isCurrent
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
