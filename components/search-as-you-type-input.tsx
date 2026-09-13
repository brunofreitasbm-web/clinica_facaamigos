"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Input de busca que atualiza a URL (query param) com debounce, para páginas
 * server-side que antes só buscavam com Enter/submit de <form method="get">.
 * Substitui apenas o <input>: o form ao redor (se houver) deixa de ser
 * necessário, pois a navegação acontece via router.replace.
 */
export function SearchAsYouTypeInput({
  paramName = "q",
  initialValue = "",
  placeholder,
  className,
  debounceMs = 300,
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

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const trimmed = value.trim();
      const query = trimmed ? `?${paramName}=${encodeURIComponent(trimmed)}` : "";
      router.replace(`${pathname}${query}`, { scroll: false });
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}
