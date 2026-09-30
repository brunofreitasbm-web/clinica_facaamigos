"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { classificarOrigem, trackEvent } from "./analytics-client";

/**
 * Métricas de experiência (SXO) e de origem (SEO/GEO/AEO) da landing, sem
 * tocar em cada componente: um único ouvinte de eventos no documento.
 *
 * - origem:   1x por sessão, classifica busca × IA × social × direto
 * - vitais:   LCP, INP, CLS, FCP, TTFB → evento `web_vitals`
 * - rolagem:  25/50/75/90% da página
 * - seções:   quando cada seção com id entra na tela (funil de leitura)
 * - cliques:  âncoras internas e links para fora (hub, mapeamento, guias)
 * - FAQ:      qual pergunta abriu (sinal de AEO: o que o visitante quer saber)
 * - formulário: primeiro foco em cada formulário (início de preenchimento)
 *
 * Nada aqui lê ou envia o que a pessoa digita: só o nome do evento, o id da
 * seção e a URL clicada. Dado de saúde de criança não passa por este arquivo.
 */
export function SiteEngagement() {
  useReportWebVitals((m) => {
    trackEvent("web_vitals", {
      metric_name: m.name,
      metric_value: Math.round(m.name === "CLS" ? m.value * 1000 : m.value),
      metric_rating: m.rating ?? "",
      metric_id: m.id,
    });
  });

  useEffect(() => {
    const limpar: Array<() => void> = [];

    // Origem — uma vez por sessão do navegador.
    try {
      if (!sessionStorage.getItem("site_origem")) {
        const utm = new URLSearchParams(location.search).get("utm_source");
        const classe = classificarOrigem(document.referrer, utm);
        sessionStorage.setItem("site_origem", classe);
        trackEvent("traffic_class", { traffic_class: classe });
      }
    } catch {
      // sessionStorage bloqueado: só perde a classificação, o resto segue.
    }

    // Profundidade de rolagem.
    const marcos = [25, 50, 75, 90];
    const disparados = new Set<number>();
    const aoRolar = () => {
      const alt = document.documentElement.scrollHeight - window.innerHeight;
      if (alt <= 0) return;
      const pct = (window.scrollY / alt) * 100;
      for (const m of marcos) {
        if (pct >= m && !disparados.has(m)) {
          disparados.add(m);
          trackEvent("scroll_depth", { percent: m });
        }
      }
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    limpar.push(() => window.removeEventListener("scroll", aoRolar));

    // Seções vistas.
    const vistas = new Set<string>();
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting && e.target.id && !vistas.has(e.target.id)) {
            vistas.add(e.target.id);
            trackEvent("section_view", { section_id: e.target.id });
          }
        }
      },
      { threshold: 0.4 },
    );
    document.querySelectorAll("section[id]").forEach((el) => obs.observe(el));
    limpar.push(() => obs.disconnect());

    // Cliques em âncoras internas e links externos.
    const aoClicar = (ev: MouseEvent) => {
      const a = (ev.target as Element | null)?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#")) {
        trackEvent("nav_click", { target: href });
      } else if (/^https?:/i.test(href) && !href.includes("wa.me")) {
        // WhatsApp já tem evento próprio (contact).
        trackEvent("outbound_click", { link_url: href.slice(0, 180) });
      }
    };
    document.addEventListener("click", aoClicar);
    limpar.push(() => document.removeEventListener("click", aoClicar));

    // FAQ aberto — `toggle` não borbulha, por isso captura.
    const aoAlternar = (ev: Event) => {
      const d = ev.target as HTMLDetailsElement | null;
      if (d?.tagName === "DETAILS" && d.open) {
        const pergunta = d.querySelector("summary")?.textContent?.trim().slice(0, 100) ?? "";
        trackEvent("faq_open", { question: pergunta });
      }
    };
    document.addEventListener("toggle", aoAlternar, true);
    limpar.push(() => document.removeEventListener("toggle", aoAlternar, true));

    // Início de preenchimento de formulário (1x por formulário).
    const iniciados = new WeakSet<Element>();
    const aoFocar = (ev: FocusEvent) => {
      const form = (ev.target as Element | null)?.closest?.("form");
      if (form && !iniciados.has(form)) {
        iniciados.add(form);
        trackEvent("form_start", { form_id: form.closest("section")?.id || "site" });
      }
    };
    document.addEventListener("focusin", aoFocar);
    limpar.push(() => document.removeEventListener("focusin", aoFocar));

    return () => limpar.forEach((f) => f());
  }, []);

  return null;
}
