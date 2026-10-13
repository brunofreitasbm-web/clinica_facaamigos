"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Input de busca otimizado pelas Leis de UX:
 * - Jakob's Law: segue convenções familiares de busca (ícone de lupa à esquerda, botão limpar à direita).
 * - Fitts's Law: botão de limpar com alvo de toque acessível e espaçoso.
 * - Doherty Threshold: resposta rápida com debounce otimizado e limpeza instantânea (<100ms).
 * - Postel's Law: tolerância a múltiplos espaços e sanitização transparente.
 */
export function SearchAsYouTypeInput({
  paramName = "q",
  initialValue = "",
  placeholder = "Buscar...",
  className,
  debounceMs = 280,
}: {
  paramName?: string;
  initialValue?: string;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialValue);
  const didMountRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyQuery = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      const query = trimmed ? `?${paramName}=${encodeURIComponent(trimmed)}` : "";
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [paramName, pathname, router]
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      applyQuery(value);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, debounceMs, applyQuery]);

  const handleClear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setValue("");
    applyQuery("");
  };

  return (
    <div className="relative flex items-center w-full">
      <span className="pointer-events-none absolute left-3 flex items-center justify-center text-neutral-400">
        <Search className="h-4 w-4" aria-hidden="true" />
      </span>

      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={
          className ??
          "input pl-9 pr-9 min-h-[44px] w-full rounded-full border border-neutral-300 bg-surface text-sm transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        }
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpar busca"
          className="absolute right-1.5 flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:scale-95 transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
