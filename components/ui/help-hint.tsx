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
  /** Nome acessível do botão. Prefira algo específico ("Como o avaliador é escolhido"). */
  label?: string;
  /** Lado preferido; inverte sozinho quando não cabe na tela. */
  side?: "top" | "bottom";
  className?: string;
}

const GAP = 8;
const MARGIN = 8;
const HOVER_CLOSE_DELAY_MS = 120;

/**
 * Ícone "?" que explica o elemento ao lado dele sem ocupar espaço da tela.
 *
 * Abre por: passar o mouse, foco do teclado, ou clique/toque (fixa aberto até
 * tocar fora, perder o foco ou apertar Esc). O toque é necessário porque no
 * iOS Safari o botão não recebe foco ao ser tocado.
 *
 * Leis de UX:
 * - Jakob: um único padrão de ajuda em todo o sistema.
 * - Fitts: ícone discreto, mas alvo de 44px quando o ponteiro é impreciso (toque).
 * - Proximidade: posicione sempre colado ao título/label/botão que ele explica.
 * - Doherty: abre na hora (sem delay), sem bloquear a interação.
 * - Postel: tolera mouse, teclado e toque.
 * - WCAG 1.4.13: o texto continua visível ao passar o mouse sobre ele, e Esc dispensa.
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = hover || focus || pinned;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const enter = useCallback(() => {
    cancelClose();
    setHover(true);
  }, [cancelClose]);

  // Pequeno atraso ao sair, para dar tempo de o mouse chegar ao tooltip.
  const leave = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHover(false), HOVER_CLOSE_DELAY_MS);
  }, [cancelClose]);

  const dismiss = useCallback(() => {
    cancelClose();
    setHover(false);
    setFocus(false);
    setPinned(false);
    setPos(null);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

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

  // Mede e posiciona depois que o tooltip entra no DOM. Fechar zera a posição
  // em `dismiss`, não aqui, para não disparar setState dentro do efeito ao fechar.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, text]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Captura: evita que o Esc também feche o diálogo/painel pai.
      e.stopPropagation();
      dismiss();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        (buttonRef.current?.contains(target) || tipRef.current?.contains(target))
      ) {
        return;
      }
      dismiss();
    };
    const onScroll = (e: Event) => {
      // Rolar dentro do próprio tooltip não deve fechá-lo.
      if (tipRef.current && e.target instanceof Node && tipRef.current.contains(e.target)) return;
      dismiss();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open, dismiss]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        // Só mouse real abre por hover: no toque, o mouseenter emulado
        // abriria e o clique logo em seguida fecharia.
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") enter();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") leave();
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          setPinned(false);
        }}
        // Clique/toque fixa o tooltip. preventDefault/stopPropagation impedem que
        // o "?" dentro de <summary>/<label>/<button> dispare a ação do pai.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pinned) dismiss();
          else setPinned(true);
        }}
        className={`inline-flex shrink-0 cursor-help items-center justify-center rounded-full align-middle text-ink-faint transition-colors duration-100 hover:text-ink focus-visible:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] ${className}`}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
      </button>
      {/* Texto sempre disponível para leitores de tela (aria-describedby). */}
      <span id={id} className="sr-only">
        {text}
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tipRef}
              role="tooltip"
              aria-hidden="true"
              onPointerEnter={enter}
              onPointerLeave={leave}
              style={{
                position: "fixed",
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                visibility: pos ? "visible" : "hidden",
              }}
              className="z-[9999] max-w-[min(20rem,calc(100vw-1rem))] rounded-lg bg-ink px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-paper shadow-lg"
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
