"use client";

import { useRef, useState, useTransition } from "react";
import { createFaq, updateFaq, toggleFaqActive, deleteFaq, type FaqCategory } from "./faq-actions";

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string | null;
  active: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  convenios: "Convênios",
  valores: "Valores",
  local: "Local",
  terapias: "Terapias",
  horarios: "Horários",
  regras: "Regras",
  outro: "Outro",
};

const CATEGORY_OPTIONS: FaqCategory[] = ["convenios", "valores", "local", "terapias", "horarios", "regras", "outro"];

function FaqRowView({ faq }: { faq: FaqRow }) {
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);
  const [category, setCategory] = useState(faq.category ?? "outro");
  const [keywords, setKeywords] = useState(faq.keywords.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPlaceholder = faq.answer.startsWith("⚠️");

  if (editing) {
    return (
      <tr>
        <td colSpan={4}>
          <div className="flex flex-col gap-2 rounded-md border border-paper-line-strong bg-paper/60 p-4">
            <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pergunta" />
            <textarea
              className="input"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Resposta que o bot deve enviar no WhatsApp"
            />
            <div className="flex flex-wrap gap-2">
              <select className="input" style={{ maxWidth: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                className="input flex-1"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Sinônimos separados por vírgula (ex.: convenio, carteirinha)"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("question", question);
                    fd.set("answer", answer);
                    fd.set("category", category);
                    fd.set("keywords", keywords);
                    const result = await updateFaq(faq.id, fd);
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    setEditing(false);
                  });
                }}
              >
                {isPending ? "Salvando…" : "Salvar"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
            {error && <p className="text-xs text-status-negative-text">{error}</p>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className={faq.active ? "" : "text-ink-faint line-through"}>
        <div className="font-semibold">{faq.question}</div>
        <div className="text-xs text-ink-faint">
          {isPlaceholder ? <span className="text-status-negative-text">⚠️ Resposta pendente de preencher</span> : faq.answer}
        </div>
      </td>
      <td>{CATEGORY_LABELS[faq.category ?? "outro"]}</td>
      <td className="text-ink-faint">
        <span className="text-xs">{faq.keywords.join(", ") || "—"}</span>
      </td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost text-xs" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await toggleFaqActive(faq.id, !faq.active);
              })
            }
          >
            {faq.active ? "Desativar" : "Ativar"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs text-status-negative-text"
            disabled={isPending}
            onClick={() => {
              if (confirm(`Excluir a pergunta "${faq.question}"?`)) {
                startTransition(async () => {
                  await deleteFaq(faq.id);
                });
              }
            }}
          >
            Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}

export function FaqManager({ faqs }: { faqs: FaqRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const pendingCount = faqs.filter((f) => f.answer.startsWith("⚠️")).length;

  return (
    <div>
      <h3 className="mb-1">FAQ do WhatsApp</h3>
      <p className="mb-2 text-sm text-ink-soft">
        Base de conhecimento do assistente de WhatsApp: cada pergunta cadastrada aqui é o que a IA (Gemini) usa para
        responder às famílias sobre convênios, terapias, valores e regras. Quando a dúvida não estiver aqui, o bot
        escala automaticamente para a recepção em vez de inventar uma resposta.
      </p>
      {pendingCount > 0 && (
        <p className="mb-6 text-sm font-semibold text-status-negative-text">
          ⚠️ {pendingCount} pergunta(s) com resposta pendente de preencher (endereço, horário, valores, telefone) — o
          bot vai escalar essas dúvidas até você completar.
        </p>
      )}

      <table className="table mb-6">
        <thead>
          <tr>
            <th>Pergunta</th>
            <th>Categoria</th>
            <th>Sinônimos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {faqs.map((f) => (
            <FaqRowView key={f.id} faq={f} />
          ))}
          {faqs.length === 0 && (
            <tr>
              <td colSpan={4} className="text-ink-faint">
                Nenhuma pergunta cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form
        ref={formRef}
        className="grid max-w-[640px] grid-cols-1 gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await createFaq(formData);
            if (!result.success) {
              setError(result.error);
              return;
            }
            formRef.current?.reset();
          });
        }}
      >
        <input name="question" required placeholder="Pergunta (ex.: Qual o horário de funcionamento?)" className="input" />
        <textarea
          name="answer"
          required
          rows={3}
          placeholder="Resposta que o bot deve enviar no WhatsApp"
          className="input"
        />
        <div className="flex flex-wrap gap-2">
          <select name="category" className="input" style={{ maxWidth: 200 }} defaultValue="outro">
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <input name="keywords" placeholder="Sinônimos separados por vírgula (opcional)" className="input flex-1" />
        </div>
        <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
          {isPending ? "Adicionando…" : "+ Adicionar pergunta"}
        </button>
        {error && <p className="text-xs text-status-negative-text">{error}</p>}
      </form>
    </div>
  );
}
