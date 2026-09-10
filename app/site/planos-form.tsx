"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { submitLead } from "./actions";
import { trackContactClick, trackLeadSubmitted } from "./analytics-client";
import { PLANOS } from "./content";

/**
 * Formulário de consulta de convênio (seção "#planos").
 *
 * Diferente do LeadForm de contato geral, este não pede compromisso: a
 * família só quer saber se o plano dela é atendido — que é a pergunta que
 * mais chega pelo WhatsApp. Ao enviar, o dado vira lead em `site_leads`
 * (com convênio e situação da guia) e a família é levada para o WhatsApp com
 * a mensagem já escrita; é essa mensagem de entrada que abre a conversa de
 * lead e aciona o bot de FAQ (ver app/site/actions.ts).
 */
export function PlanosForm({
  convenios,
}: {
  convenios: Array<{ id: string; name: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [convenio, setConvenio] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const result = await submitLead(formData);
      if (!result.success) {
        setErro(result.error);
        return;
      }
      trackLeadSubmitted("planos");
      formRef.current?.reset();
      setConvenio("");
      if (result.whatsappUrl) {
        setWhatsappUrl(result.whatsappUrl);
        // Abre a conversa já com a mensagem pronta. Pode ser barrado por
        // bloqueador de pop-up — por isso a tela de sucesso repete o link
        // como botão, em vez de depender só desta chamada.
        window.open(result.whatsappUrl, "_blank", "noopener");
        trackContactClick("whatsapp", "planos");
      }
    });
  }

  if (whatsappUrl) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-12 text-center shadow-xl">
        <CheckCircle2 className="h-11 w-11 text-teal" aria-hidden />
        <p className="font-display text-2xl font-semibold text-[var(--color-dark)]">
          {PLANOS.formulario.sucessoTitulo}
        </p>
        <p className="max-w-sm text-[15px] text-[var(--text-secondary)]">
          {PLANOS.formulario.sucessoTexto}
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackContactClick("whatsapp", "planos-sucesso")}
          className="btn btn-primary mt-1"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {PLANOS.formulario.sucessoBotao}
        </a>
      </div>
    );
  }

  return (
    <form ref={formRef} action={onSubmit} className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-xl sm:p-8">
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-xl font-extrabold text-[var(--color-dark)]">{PLANOS.formulario.titulo}</h3>
        <p className="m-0 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {PLANOS.formulario.subtitulo}
        </p>
      </div>

      {/* Honeypot anti-bot — invisível para pessoas, preenchido só por bots que leem o DOM. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <input type="hidden" name="origem" value="planos" />

      <div className="field">
        <label htmlFor="plano-convenio">{PLANOS.campos.plano}</label>
        <select
          id="plano-convenio"
          name="convenio"
          required
          className="input"
          value={convenio}
          onChange={(e) => setConvenio(e.target.value)}
        >
          <option value="" disabled>
            {PLANOS.campos.planoPlaceholder}
          </option>
          {convenios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="outro">{PLANOS.campos.planoOutroRotulo}</option>
          <option value="particular">{PLANOS.campos.planoParticularRotulo}</option>
        </select>
      </div>

      {convenio === "outro" && (
        <div className="field">
          <label htmlFor="plano-convenio-outro">{PLANOS.campos.planoOutroCampo}</label>
          <input
            id="plano-convenio-outro"
            name="convenio_outro"
            required
            maxLength={120}
            className="input"
            placeholder={PLANOS.campos.planoOutroPlaceholder}
          />
        </div>
      )}

      <fieldset className="field m-0 border-0 p-0">
        <legend className="mb-1.5 p-0 text-sm font-bold text-[var(--color-dark)]">
          {PLANOS.guia.pergunta}
        </legend>
        <div className="flex flex-wrap gap-2">
          {PLANOS.guia.opcoes.map((o) => (
            <label
              key={o.valor}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--color-paper-line)] px-4 py-2 text-sm font-semibold text-[var(--color-dark)] has-[:checked]:border-[var(--color-teal)] has-[:checked]:bg-[var(--color-teal-100)] has-[:checked]:text-[var(--color-teal-800)]"
            >
              <input type="radio" name="tem_guia" value={o.valor} className="accent-[var(--color-teal)]" />
              {o.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="plano-nome">Seu nome</label>
        <input
          id="plano-nome"
          name="nome"
          required
          maxLength={120}
          autoComplete="name"
          className="input"
          placeholder="Como podemos te chamar?"
        />
      </div>

      <div className="field">
        <label htmlFor="plano-telefone">WhatsApp</label>
        <input
          id="plano-telefone"
          name="telefone"
          required
          inputMode="tel"
          autoComplete="tel"
          className="input"
          placeholder="(91) 90000-0000"
        />
      </div>

      <div className="field">
        <label htmlFor="plano-idade">Idade da criança (opcional)</label>
        <input id="plano-idade" name="idade" maxLength={60} className="input" placeholder="Ex.: 3 anos e meio" />
      </div>

      {erro && (
        <p role="alert" className="rounded-xl bg-[var(--color-status-negative-soft)] px-4 py-2.5 text-sm font-medium text-[var(--color-status-negative-text)]">
          {erro}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-block justify-center text-base">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MessageCircle className="h-4 w-4" aria-hidden />}
        {pending ? PLANOS.formulario.botaoEnviando : PLANOS.formulario.botao}
      </button>

      <p className="flex items-start gap-2 text-center text-xs text-[var(--text-secondary)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-teal)]" aria-hidden />
        <span className="text-left">{PLANOS.formulario.consentimento}</span>
      </p>
    </form>
  );
}
