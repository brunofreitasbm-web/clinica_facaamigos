"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, CalendarPlus, MessageCircle, AlertCircle, FileText, Boxes, CalendarDays, User } from "lucide-react";

export type PalettePatient = {
  id: string;
  fullName: string;
  guardianName: string | null;
  guardianPhone: string | null;
};

type ActionItem = {
  kind: "action";
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: typeof Search;
};

type PatientItem = {
  kind: "patient";
  id: string;
  label: string;
  hint: string;
  href: string;
};

type Item = ActionItem | PatientItem;

const ACTIONS: ActionItem[] = [
  { kind: "action", id: "nova-sessao", label: "Nova sessão", hint: "Agendar uma sessão", href: "/recepcao#nova-sessao", icon: CalendarPlus },
  { kind: "action", id: "novo-paciente", label: "Novo paciente", hint: "Cadastro rápido (nome + telefone)", href: "/recepcao/pacientes/novo", icon: UserPlus },
  { kind: "action", id: "agenda", label: "Agenda do dia", hint: "Confirmar, check-in, check-out", href: "/recepcao", icon: CalendarDays },
  { kind: "action", id: "whatsapp", label: "Confirmar amanhã (WhatsApp)", hint: "Lembrete D-1 para as famílias", href: "/recepcao/whatsapp", icon: MessageCircle },
  { kind: "action", id: "pendencias", label: "Pendências", hint: "Guia vencendo, cadastro incompleto, documento vencido", href: "/recepcao/pacientes/pendencias", icon: AlertCircle },
  { kind: "action", id: "documentos", label: "Documentos", hint: "Declarações, atestados, comprovantes", href: "/recepcao/documentos", icon: FileText },
  { kind: "action", id: "recursos", label: "Salas e recursos", hint: "Reservar sala ou equipamento", href: "/recepcao/recursos", icon: Boxes },
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Paleta de comando da recepção (Ctrl+K ou botão "Buscar paciente"):
 * digita o nome (ou telefone do responsável) e Enter abre a ficha; sem
 * texto, lista as ações do dia. É o "onde está X?" resolvido sem menu.
 */
export function RecepcaoCommandPalette({ patients, children }: { patients: PalettePatient[]; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPalette() {
    setQuery("");
    setCursor(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (v) return false;
          openPalette();
          return true;
        });
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = normalize(query.trim());
    if (!q) return ACTIONS;
    const digits = q.replace(/\D/g, "");
    const patientMatches: PatientItem[] = patients
      .filter((p) => {
        if (normalize(p.fullName).includes(q)) return true;
        if (p.guardianName && normalize(p.guardianName).includes(q)) return true;
        if (digits.length >= 4 && p.guardianPhone && p.guardianPhone.replace(/\D/g, "").includes(digits)) return true;
        return false;
      })
      .slice(0, 8)
      .map((p) => ({
        kind: "patient",
        id: p.id,
        label: p.fullName,
        hint: p.guardianName ? `${p.guardianName}${p.guardianPhone ? ` · ${p.guardianPhone}` : ""}` : "Sem responsável cadastrado",
        href: `/recepcao/pacientes/${p.id}`,
      }));
    const actionMatches = ACTIONS.filter((a) => normalize(a.label).includes(q) || normalize(a.hint).includes(q));
    return [...patientMatches, ...actionMatches];
  }, [query, patients]);

  const activeCursor = Math.min(cursor, Math.max(items.length - 1, 0));

  function go(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  return (
    <>
      <button type="button" onClick={openPalette} className="contents" aria-label="Buscar paciente ou ação (Ctrl+K)">
        {children}
      </button>

      {open && (
        <div className="dialog-backdrop" style={{ alignItems: "start", paddingTop: "12vh" }} onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: 620, padding: 0, gap: 0, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--color-neutral-200)" }}>
              <Search size={18} style={{ color: "var(--color-neutral-500)" }} aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor(Math.min(activeCursor + 1, items.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor(Math.max(activeCursor - 1, 0));
                  } else if (e.key === "Enter" && items[activeCursor]) {
                    e.preventDefault();
                    go(items[activeCursor]);
                  }
                }}
                placeholder="Nome do paciente, do responsável ou telefone…"
                className="w-full bg-transparent text-[15px] outline-none"
                autoComplete="off"
              />
              <kbd className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--color-neutral-100)", color: "var(--color-neutral-600)" }}>
                Esc
              </kbd>
            </div>

            <ul className="max-h-[50vh] overflow-y-auto py-2" role="listbox">
              {items.length === 0 && (
                <li className="px-4 py-6 text-center text-sm" style={{ color: "var(--color-neutral-600)" }}>
                  Nenhum paciente com esse nome.{" "}
                  <button type="button" className="underline" style={{ color: "var(--color-accent)" }} onClick={() => go(ACTIONS[1])}>
                    Cadastrar novo paciente
                  </button>
                </li>
              )}
              {!query.trim() && (
                <li className="px-4 pb-1 pt-1 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--color-accent-2-700)" }}>
                  Ações rápidas
                </li>
              )}
              {items.map((item, i) => {
                const Icon = item.kind === "action" ? item.icon : User;
                const active = i === activeCursor;
                return (
                  <li key={`${item.kind}-${item.id}`} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(item)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                      style={{ background: active ? "var(--color-accent-100)" : "transparent" }}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                        style={{
                          background: item.kind === "patient" ? "var(--color-accent-2)" : "var(--color-neutral-100)",
                          color: item.kind === "patient" ? "#fff" : "var(--color-ink)",
                        }}
                      >
                        <Icon size={15} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                          {item.label}
                        </span>
                        <span className="block truncate text-xs" style={{ color: "var(--color-neutral-600)" }}>
                          {item.hint}
                        </span>
                      </span>
                      {active && (
                        <kbd className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--color-neutral-100)", color: "var(--color-neutral-600)" }}>
                          Enter
                        </kbd>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
