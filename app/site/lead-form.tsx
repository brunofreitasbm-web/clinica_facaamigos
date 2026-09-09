"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { submitLead } from "./actions";

/**
 * Formulário de agendamento (seção "CTA final"). Fica pendurado no fim da
 * página, mas o header e o hero apontam pra cá via âncora (#agendar).
 */
export function LeadForm({ origem = "cta-final" }: { origem?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function onSubmit(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const result = await submitLead(formData);
      if (result.success) {
        setEnviado(true);
        formRef.current?.reset();
      } else {
        setErro(result.error);
      }
    });
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-12 text-center shadow-xl">
        <CheckCircle2 className="h-11 w-11 text-teal" aria-hidden />
        <p className="font-display text-2xl font-semibold text-[var(--color-dark)]">Recebemos seu pedido!</p>
        <p className="max-w-sm text-[15px] text-[var(--text-secondary)]">
          Nossa recepção entra em contato em até 2h úteis para marcar a avaliação. Se preferir, fale
          agora mesmo pelo WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={onSubmit} className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-xl sm:p-8">
      {/* Honeypot anti-bot — invisível para pessoas, preenchido só por bots que leem o DOM. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <input type="hidden" name="origem" value={origem} />

      <div className="field">
        <label htmlFor="lead-nome">Seu nome</label>
        <input id="lead-nome" name="nome" required maxLength={120} autoComplete="name" className="input" placeholder="Como podemos te chamar?" />
      </div>

      <div className="field">
        <label htmlFor="lead-telefone">WhatsApp ou telefone</label>
        <input
          id="lead-telefone"
          name="telefone"
          required
          inputMode="tel"
          autoComplete="tel"
          className="input"
          placeholder="(91) 90000-0000"
        />
      </div>

      <div className="field">
        <label htmlFor="lead-idade">Idade da criança (opcional)</label>
        <input id="lead-idade" name="idade" maxLength={60} className="input" placeholder="Ex.: 3 anos e meio" />
      </div>

      <div className="field">
        <label htmlFor="lead-mensagem">Quer contar algo a mais? (opcional)</label>
        <textarea
          id="lead-mensagem"
          name="mensagem"
          maxLength={2000}
          className="input"
          rows={3}
          placeholder="O que te fez procurar a gente agora?"
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-xl bg-[var(--color-status-negative-soft)] px-4 py-2.5 text-sm font-medium text-[var(--color-status-negative-text)]">
          {erro}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-block justify-center text-base">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {pending ? "Enviando..." : "Agendar avaliação"}
      </button>

      <p className="text-center text-xs text-[var(--text-secondary)]">
        Ao enviar, você concorda em ser contatado pela nossa recepção. Seus dados são usados só
        para isso.
      </p>
    </form>
  );
}
