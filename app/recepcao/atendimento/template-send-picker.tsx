"use client";

import { useState, useTransition } from "react";
import { sendTemplateMessage } from "./actions";

// Mesmas categorias que lib/twilio.ts getTwilioContentSidForCategory mapeia
// pra uma variável de ambiente TWILIO_*_TEMPLATE_CONTENT_SID — os bots já
// usam essas categorias com dados específicos do fluxo (data da avaliação,
// terapeuta etc.); aqui a recepção manda o texto livre que quer registrar
// no histórico, mas o que a família recebe é o MODELO aprovado pela Meta
// (a Twilio ignora `message`/`previewText` quando `contentSid` é passado —
// ver sendTwilioWhatsApp em lib/twilio.ts). Categoria sem
// TWILIO_*_TEMPLATE_CONTENT_SID configurado no ambiente falha com um erro
// claro (getTwilioContentSidForCategory retorna undefined).
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "renovacao_guia", label: "Renovação de guia" },
  { value: "cobranca", label: "Cobrança" },
  { value: "reuniao_responsavel", label: "Reunião com responsável" },
  { value: "devolutiva_paciente", label: "Devolutiva ao paciente" },
  { value: "nps", label: "Pesquisa de satisfação (NPS)" },
  { value: "triagem_convenio", label: "Triagem de convênio" },
];

export function TemplateSendPicker({
  conversationId,
  guardianName,
  contactName,
}: {
  conversationId: string;
  guardianName?: string | null;
  contactName?: string | null;
}) {
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const handleSend = () => {
    setFeedback(null);
    startTransition(async () => {
      const previewText = note.trim() || `Modelo aprovado enviado para ${guardianName ?? contactName ?? "o contato"}.`;
      const result = await sendTemplateMessage(conversationId, category, previewText);
      if (result.success) {
        setFeedback({ kind: "success", text: "Modelo enviado." });
        setNote("");
      } else {
        setFeedback({ kind: "error", text: result.error ?? "Falha ao enviar o modelo." });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          className="input flex-1 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isPending}
          aria-label="Categoria do modelo aprovado"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary shrink-0 disabled:opacity-50" disabled={isPending} onClick={handleSend}>
          {isPending ? "Enviando…" : "Enviar modelo"}
        </button>
      </div>
      <input
        className="input text-sm"
        placeholder="Nota interna sobre este envio (opcional — não é o texto do modelo)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={isPending}
      />
      {feedback && (
        <p className={`text-xs ${feedback.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
