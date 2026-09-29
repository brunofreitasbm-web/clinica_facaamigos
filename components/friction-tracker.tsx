"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { RageClickDetector, normalizeRoute } from "@/lib/ux-friction";

/**
 * Coletor de sinais de fricção de uso (ver lib/ux-friction.ts para as regras e
 * a política de privacidade, e docs/ux-friccao-metabase.md para como ler os
 * relatórios). Montado uma vez em app/layout.tsx; não renderiza nada.
 *
 * Sinais coletados:
 *  - page_view: por passagem numa tela — tempo visível, nº de cliques e
 *    "tempo até a 1ª ação" (hesitação / não achou o que procurava).
 *  - rage_click: 3+ cliques no mesmo ponto em 1s.
 *  - dead_click: clicou em algo que parece clicável e a tela não mudou em 1s.
 *  - form_error: o navegador barrou o envio de um formulário.
 *  - ui_error: aviso de erro (toast) ou tela de erro — via `reportUxError`.
 *
 * Nunca lê valores de campos. Rótulo de botão dentro de listas/tabelas (onde
 * costuma aparecer nome de paciente) é substituído por um texto genérico.
 * Para excluir uma área inteira, use `data-ux-ignore`; para dar um nome
 * estável a um botão no relatório, use `data-ux="Salvar guia"`.
 */

// Telas públicas / de família: não monitoradas (a rota também descarta).
const IGNORED_PREFIXES = ["/login", "/checkin", "/ficha", "/assinar", "/site", "/trocar-senha", "/familia"];

const INTERACTIVE =
  'button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary, input[type="submit"], input[type="button"]';
// Cliques que legitimamente não mudam o DOM: não contam como "dead click".
const NO_DOM_CHANGE_EXPECTED =
  'label, input[type="file"], input[type="checkbox"], input[type="radio"], select, a[target="_blank"], a[download], a[href^="#"], a[href^="mailto:"], a[href^="tel:"]';
const LIST_CONTEXT = 'tr, li, [role="row"], [role="listitem"], article, [data-ux-private]';

const FLUSH_INTERVAL_MS = 10_000;
const DEAD_CLICK_WAIT_MS = 1000;
const BATCH = 30;

interface QueuedEvent {
  type: "page_view" | "rage_click" | "dead_click" | "form_error" | "ui_error";
  route: string;
  target?: string | null;
  detail?: Record<string, number | string>;
  /** performance.now() de quando aconteceu; vira `agoMs` no envio. */
  at: number;
}

interface PageState {
  route: string;
  startedAt: number;
  visibleMs: number;
  visibleSince: number | null;
  clicks: number;
  firstActionAt: number | null;
}

/** Avisa o monitor de um erro visível ao operador (toast vermelho, tela de erro). */
export function reportUxError(kind: "toast" | "crash", text?: string) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("ux:error", { detail: { kind, text } }));
  } catch {
    // monitoramento nunca pode quebrar a tela
  }
}

function labelFor(el: Element): string | null {
  const explicit = el.getAttribute("data-ux");
  if (explicit) return explicit;
  if (el.closest(LIST_CONTEXT)) return "botão dentro de lista";
  const text = el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || "";
  return text.trim() ? text : el.tagName.toLowerCase();
}

function newSessionId(): string {
  try {
    const existing = sessionStorage.getItem("__ux_sid");
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem("__ux_sid", id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export function FrictionTracker() {
  const pathname = usePathname();
  const pageRef = useRef<PageState | null>(null);
  const queueRef = useRef<QueuedEvent[]>([]);
  const sessionRef = useRef<string>("");
  const flushRef = useRef<() => void>(() => {});
  const pageEnderRef = useRef<() => void>(() => {});

  // Passagem por tela: abre ao entrar, fecha (emite page_view) ao sair.
  useEffect(() => {
    if (IGNORED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    const now = performance.now();
    pageRef.current = {
      route: normalizeRoute(pathname),
      startedAt: now,
      visibleMs: 0,
      visibleSince: document.hidden ? null : now,
      clicks: 0,
      firstActionAt: null,
    };
    const end = () => {
      const page = pageRef.current;
      if (!page) return;
      pageRef.current = null;
      const t = performance.now();
      const visible = page.visibleMs + (page.visibleSince !== null ? t - page.visibleSince : 0);
      queueRef.current.push({
        type: "page_view",
        at: t,
        route: page.route,
        detail: {
          dwell_ms: visible,
          clicks: page.clicks,
          ...(page.firstActionAt !== null ? { ttfa_ms: page.firstActionAt - page.startedAt } : {}),
        },
      });
      if (queueRef.current.length >= 10) flushRef.current();
    };
    pageEnderRef.current = end;
    return end;
  }, [pathname]);

  // Listeners globais (uma vez).
  useEffect(() => {
    sessionRef.current = newSessionId();
    let stopped = false;

    const flush = () => {
      const queue = queueRef.current;
      while (queue.length > 0 && !stopped) {
        const events = queue.splice(0, BATCH);
        fetch("/api/ux-events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionRef.current,
            events: events.map(({ at, ...e }) => ({ ...e, agoMs: performance.now() - at })),
          }),
          keepalive: true,
        })
          .then((res) => {
            // Sessão expirada: para de tentar até a próxima carga da página.
            if (res.status === 401) stopped = true;
          })
          .catch(() => {});
      }
    };
    flushRef.current = flush;

    const push = (e: Omit<QueuedEvent, "route" | "at">) => {
      const route = pageRef.current?.route;
      if (!route) return;
      queueRef.current.push({ ...e, route, at: performance.now() });
    };

    let lastMutation = 0;
    const observer = new MutationObserver(() => {
      lastMutation = performance.now();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });

    const rage = new RageClickDetector();

    const markAction = () => {
      const page = pageRef.current;
      if (page && page.firstActionAt === null) page.firstActionAt = performance.now();
    };

    const onClick = (ev: MouseEvent) => {
      const page = pageRef.current;
      if (!page) return;
      const now = performance.now();
      page.clicks += 1;
      markAction();

      const el = ev.target instanceof Element ? ev.target : null;
      if (!el || el.closest("[data-ux-ignore]")) return;
      const interactive = el.closest(INTERACTIVE);
      const candidate = interactive ?? (getComputedStyle(el).cursor === "pointer" ? el : null);

      if (rage.record(now, ev.clientX, ev.clientY)) {
        push({ type: "rage_click", target: candidate ? labelFor(candidate) : "área sem ação" });
      }

      if (!candidate || candidate.closest(NO_DOM_CHANGE_EXPECTED)) return;
      const routeAtClick = page.route;
      const ariaDisabled = candidate.getAttribute("aria-disabled") === "true";
      const target = labelFor(candidate);
      setTimeout(() => {
        if (document.hidden) return;
        if (pageRef.current?.route !== routeAtClick) return; // navegou: funcionou
        if (lastMutation >= now) return; // a tela reagiu
        push({ type: "dead_click", target, detail: ariaDisabled ? { disabled: 1 } : undefined });
      }, DEAD_CLICK_WAIT_MS);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      const el = ev.target;
      if (el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable]")) markAction();
    };

    let lastFormError = -Infinity;
    const onInvalid = (ev: Event) => {
      const now = performance.now();
      // Vários campos inválidos na mesma tentativa = um evento só.
      if (now - lastFormError < 500) return;
      lastFormError = now;
      const el = ev.target as HTMLInputElement | null;
      push({ type: "form_error", detail: { field: el?.name || el?.id || "campo" } });
    };

    const onUxError = (ev: Event) => {
      const { kind, text } = (ev as CustomEvent<{ kind: string; text?: string }>).detail ?? {};
      push({ type: "ui_error", target: text ?? null, detail: { kind: kind ?? "erro" } });
    };

    const onVisibility = () => {
      const page = pageRef.current;
      const t = performance.now();
      if (page) {
        if (document.hidden && page.visibleSince !== null) {
          page.visibleMs += t - page.visibleSince;
          page.visibleSince = null;
        } else if (!document.hidden && page.visibleSince === null) {
          page.visibleSince = t;
        }
      }
      if (document.hidden) flush();
    };

    const onPageHide = () => {
      pageEnderRef.current();
      flush();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("ux:error", onUxError);
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("ux:error", onUxError);
      clearInterval(timer);
      observer.disconnect();
      flush();
    };
  }, []);

  return null;
}
