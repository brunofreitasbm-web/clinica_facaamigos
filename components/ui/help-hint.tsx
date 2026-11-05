"use client";

import { HelpCircle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface HelpHintProps {
  /** Texto da explicação. Mantenha em até ~2 frases (Miller / Hick). */
  text: ReactNode;
  /** Nome acessível do botão. */
  label?: string;
  /** Lado preferido; inverte sozinho quando não cabe na tela. */
  side?: "top" | "bottom";
  className?: string;
}

const GAP = 8;
const MARGIN = 8;

/**
 * Ícone "?" que explica o elemento ao lado dele sem ocupar espaço da tela.
 *
 * Leis de UX:
 * - Jakob: um único padrão de ajuda em todo o sistema.
 * - Fitts: ícone discreto, mas alvo de 44px quando o ponteiro é impreciso (toque).
 * - Proximidade: posicione sempre colado ao título/label/botão que ele explica.
 * - Doherty: abre na hora (sem delay), sem bloquear a interação.
 * - Postel: abre por hover ou foco; fecha por saída do mouse, blur ou Esc.
 *
 * Não usar para avisos críticos, erros ou ações obrigatórias (Von Restorff):
 * esses precisam continuar visíveis na tela.
 */
export function HelpHint({
  text,
  label = "Ajuda",
  side = "top",
  className = "",
}: HelpHintProps) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const btn = buttonRef.current;
    const tip = tipRef.current;
    if (!btn || !tip) return;
    const b = btn.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const fitsTop = b.top - GAP - t.height >= MARGIN;
    const fitsBottom = b.bottom + GAP + t.height <= vh - MARGIN;
    const useTop = side === "top" ? fitsTop || !fitsBottom : !fitsBottom && fitsTop;

    const top = useTop ? b.top - GAP - t.height : b.bottom + GAP;
    let left = b.left + b.width / 2 - t.width / 2;
    left = Math.max(MARGIN, Math.min(left, vw - t.width - MARGIN));
    setPos({ top, left });
  }, [side]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place, text]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // Impede que o "?" dentro de <summary>/<label>/<button> dispare a ação do pai.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`inline-flex shrink-0 cursor-help items-center justify-center rounded-full align-middle text-ink-faint transition-colors duration-100 hover:text-ink focus-visible:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] ${className}`}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tipRef}
              id={id}
              role="tooltip"
              style={{
                position: "fixed",
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                visibility: pos ? "visible" : "hidden",
              }}
              className="pointer-events-none z-[9999] max-w-[min(20rem,calc(100vw-1rem))] rounded-lg bg-ink px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-paper shadow-lg"
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
