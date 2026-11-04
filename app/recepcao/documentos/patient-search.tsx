"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export interface SearchablePatient {
  id: string;
  fullName: string;
  birthDate?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianCpf?: string | null;
}

const MAX_RESULTS = 8;

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const onlyDigits = (s: string) => s.replace(/\D/g, "");

function fmtBirth(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : null;
}

/**
 * Busca estilo "spotlight": todos os termos digitados precisam aparecer (em
 * qualquer ordem) no nome do paciente, do responsável, no CPF ou no telefone.
 */
function matches(p: SearchablePatient, query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  const text = normalize(`${p.fullName} ${p.guardianName ?? ""}`);
  const digits = onlyDigits(`${p.guardianCpf ?? ""} ${p.guardianPhone ?? ""}`);
  return terms.every((t) => {
    if (text.includes(t)) return true;
    const d = onlyDigits(t);
    return d.length >= 3 && digits.includes(d);
  });
}

export function PatientSearch({
  patients,
  selected,
  onSelect,
  onClear,
}: {
  patients: SearchablePatient[];
  selected?: SearchablePatient | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(
    () => patients.filter((p) => matches(p, query)).slice(0, MAX_RESULTS),
    [patients, query],
  );
  const hasQuery = query.trim().length > 0;

  const choose = (p: SearchablePatient) => {
    onSelect(p.id);
    setQuery("");
    setOpen(false);
    setActive(0);
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-pink-200 bg-pink-50/60 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{selected.fullName}</p>
          {selected.guardianName && (
            <p className="truncate text-xs text-gray-500">Resp: {selected.guardianName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onClear();
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          aria-label="Limpar paciente selecionado"
          className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-white hover:text-gray-800 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open && hasQuery}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Buscar por nome do paciente, responsável, CPF ou telefone…"
        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-3.5 text-sm font-medium text-gray-800 focus:bg-white focus:border-pink-500 focus:outline-none transition-all"
      />

      {open && hasQuery && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3.5 py-3 text-xs text-gray-500">
              Nenhum paciente encontrado — preencha manualmente abaixo.
            </li>
          ) : (
            results.map((p, i) => {
              const birth = fmtBirth(p.birthDate);
              return (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={i === active}
                  // mouseDown (não click): dispara antes do blur do input fechar a lista.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(p);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-3.5 py-2.5 ${i === active ? "bg-pink-50" : ""}`}
                >
                  <p className="text-sm font-semibold text-gray-900">{p.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {p.guardianName ? `Resp: ${p.guardianName}` : "Sem responsável cadastrado"}
                    {birth ? ` · Nasc. ${birth}` : ""}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
