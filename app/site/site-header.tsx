"use client";

import { useState } from "react";
import { Menu, X, MessageCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MENU, CTA, linkWhatsApp } from "./content";
import { trackContactClick } from "./analytics-client";

/**
 * Header fixo da landing. Cliente só por causa do menu mobile (abrir/fechar);
 * o resto é link simples de âncora, sem JS de scroll.
 */
export function SiteHeader() {
  const [aberto, setAberto] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-paper-line)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <a href="#inicio" className="shrink-0" aria-label="FaçaAmigos — início">
          <Logo variant="horizontal-compacto" height={32} />
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegação principal">
          {MENU.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[15px] font-semibold text-[var(--color-dark)] no-underline transition-colors hover:text-[var(--color-pink)]"
            >
              {item.rotulo}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={linkWhatsApp()}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackContactClick("whatsapp", "header-desktop")}
            className="btn btn-secondary !min-h-0 !py-2.5 text-sm"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {CTA.secundario}
          </a>
          <a href="#agendar" className="btn btn-primary !min-h-0 flex-col !gap-0 !py-2 text-sm leading-tight">
            <span>{CTA.principal}</span>
            <span className="text-[10px] font-medium opacity-85">{CTA.principalApoio}</span>
          </a>
        </div>

        {/*
          A visibilidade por breakpoint (md:hidden) precisa estar num
          elemento SEM classe de componente (.btn/.btn-icon): as classes
          cruas de app/globals.css (.btn, .card, .input, ...) vêm depois das
          utilities do Tailwind no CSS final, então empatam em especificidade
          com "hidden"/"md:hidden" e vencem por ordem — a "hidden" perderia
          e o botão apareceria também em telas largas. Ver o comentário
          sobre @layer base em app/globals.css, mesmo motivo.
        */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="btn btn-icon"
            aria-expanded={aberto}
            aria-controls="menu-mobile"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          >
            {aberto ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {aberto && (
        <div id="menu-mobile" className="flex flex-col gap-1 border-t border-[var(--color-paper-line)] bg-white px-5 py-4 md:hidden">
          {MENU.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className="rounded-xl px-3 py-2.5 text-[15px] font-semibold text-[var(--color-dark)] no-underline hover:bg-[var(--color-neutral-100)]"
            >
              {item.rotulo}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <a
              href={linkWhatsApp()}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackContactClick("whatsapp", "header-mobile")}
              className="btn btn-secondary justify-center"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {CTA.secundario}
            </a>
            <a href="#agendar" onClick={() => setAberto(false)} className="btn btn-primary justify-center">
              {CTA.principal}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
