"use client";

import { useState, useTransition } from "react";
import { sendTemplateMessage } from "./actions";

// Mesmas categorias que lib/twilio.ts getTwilioContentSidForCategory mapeia
// pra uma variável de ambiente TWILIO_*_TEMPLATE_CONTENT_SID — os bots já
// usam essas categorias com dados específicos do fluxo (data da avaliação,
// terapeuta etc.). O que a família recebe é o MODELO aprovado pela Meta: a
// Twilio ignora `message`/`previewText` quando `contentSid` é passado (ver
// sendTwilioWhatsApp em lib/twilio.ts). Categoria sem
// TWILIO_*_TEMPLATE_CONTENT_SID configurado no ambiente falha com um erro
// claro (getTwilioContentSidForCategory retorna undefined).
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "abertura_contato", label: "Abertura de contato (janela fechada)" },
  { value: "renovacao_guia", label: "Renovação de guia" },
  { value: "reuniao_responsavel", label: "Reunião com responsável" },
  { value: "devolutiva_paciente", label: "Devolutiva ao paciente" },
  { value: "nps", label: "Pesquisa de satisfação (NPS)" },
  { value: "triagem_convenio", label: "Triagem de convênio" },
];

export function TemplateSendPicker({
  conversationId,
}: {
  conversationId: string;
  guardianName?: string | null;
  contactName?: string | null;
}) {
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const handleSend = () => {
    setFeedback(null);
    const label = CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category;
    startTransition(async () => {
      // Texto que fica no histórico. Antes era um campo livre ("Nota interna") que aparecia na conversa
      // como se a família tivesse recebido aquelas palavras, quando ela recebe o modelo aprovado.
      const result = await sendTemplateMessage(conversationId, category, `Modelo enviado: ${label}`);
      if (result.success) {
        setFeedback({ kind: "success", text: "Modelo enviado." });
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
      <p className="text-xs text-slate-600 dark:text-slate-400">
        A família recebe o texto padrão aprovado pela Meta para esta categoria; ele não pode ser editado aqui. No
        histórico fica registrado como “Modelo enviado”.
      </p>
      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`text-xs ${feedback.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
