"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Data de nascimento em 3 selects (dia/mês/ano) em vez de `<input type=date>`:
 * o teclado nativo de data é ruim para quem não usa smartphone no dia a dia
 * (avô, motorista de van — ver F11 do plano) e varia muito entre aparelhos.
 */
function BirthDateSelects({ onChange }: { onChange: (iso: string | null) => void }) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i);

  useEffect(() => {
    if (day && month && year) {
      onChange(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    } else {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, month, year]);

  return (
    <div className="grid grid-cols-3 gap-2">
      <select className="input" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Dia de nascimento">
        <option value="">Dia</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select className="input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês de nascimento">
        <option value="">Mês</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select className="input" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Ano de nascimento">
        <option value="">Ano</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

type Step = "form" | "success" | "error";

export function CheckinForm({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("form");
  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [ticketLabel, setTicketLabel] = useState("");
  const [statusMessage, setStatusMessage] = useState("Em instantes você será chamado pela recepção.");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate || firstName.trim().length < 2) {
      setError("Preencha seu primeiro nome e data de nascimento.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, firstName: firstName.trim(), birthDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível registrar sua chegada.");
        setSubmitting(false);
        return;
      }
      setTicketLabel(data.ticketLabel);
      setStep("success");
    } catch {
      setError("Sem conexão. Fale com a recepção.");
    } finally {
      setSubmitting(false);
    }
  }

  // Poll de status: troca a mensagem quando a recepção já confirmou a
  // chegada, e a tela se limpa sozinha depois de um tempo (LGPD — F7: nunca
  // fica com a senha do anterior exposta pro próximo da fila).
  useEffect(() => {
    if (step !== "success") return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/checkin/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "confirmado") {
          setStatusMessage("A recepção já registrou sua chegada. Aguarde ser chamado.");
        }
      } catch {
        // silencioso — a tela não precisa reagir a uma falha de poll isolada
      }
    }, 20_000);

    resetTimer.current = setTimeout(() => {
      setStep("form");
      setFirstName("");
      setBirthDate(null);
    }, 20_000);

    return () => {
      clearInterval(poll);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [step]);

  if (step === "success") {
    return (
      <div className="card items-center text-center gap-4 p-8">
        <p className="card-kicker">Sua senha</p>
        <p style={{ fontFamily: "var(--font-heading, var(--font-fredoka))", fontSize: "4rem", lineHeight: 1 }}>
          {ticketLabel}
        </p>
        <p className="card-body">{statusMessage}</p>
        <p className="card-body" style={{ opacity: 0.7, fontSize: "0.8rem" }}>
          A chamada segue o horário agendado, não a ordem de chegada.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card gap-4 p-8">
      <div className="text-center">
        <p className="card-title" style={{ fontSize: "1.5rem" }}>Bem-vindo(a)!</p>
        <p className="card-body">Informe seus dados para fazer o check-in.</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Seu primeiro nome</span>
        <input
          className="input"
          style={{ fontSize: "1.25rem", padding: "0.75rem" }}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Ex: Ana"
          autoComplete="off"
          autoFocus
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Data de nascimento</span>
        <BirthDateSelects onChange={setBirthDate} />
      </label>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ fontSize: "1.1rem", padding: "0.9rem" }}>
        {submitting ? "Enviando..." : "Fazer check-in"}
      </button>

      <p className="card-body text-center" style={{ fontSize: "0.8rem", opacity: 0.7 }}>
        Sem celular à mão? Fale com a recepção.
      </p>
    </form>
  );
}
