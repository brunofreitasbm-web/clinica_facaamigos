"use client";

import { useRef, useState, useTransition } from "react";
import { sendSimulatedMessage, resetSimulatorConversation, expireSimulatorWindow, type TranscriptRow } from "./simulador-actions";

export function SimulatorPanel({ initialTranscript }: { initialTranscript: TranscriptRow[] }) {
  // A lista vem do Server Component; após cada ação recarregamos a página
  // inteira (window.location.reload()) em vez de manter estado local, então
  // não precisamos de um setter — só do valor mais recente vindo via props.
  const transcript = initialTranscript;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSend(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await sendSimulatedMessage(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setText("");
      formRef.current?.reset();
      // Recarrega a página inteira seria mais simples, mas preferimos manter
      // o estado do formulário — revalidatePath já invalida o cache do
      // Server Component; um refresh leve resolve.
      window.location.reload();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="rounded-lg border border-[#cfc8b4] bg-white p-5 space-y-3">
        <h3 className="text-sm font-bold">Conversa (número de teste)</h3>
        <div className="h-[420px] overflow-y-auto flex flex-col gap-2 border border-[#e4dfd2] rounded-md p-3 bg-[#faf8f3]">
          {transcript.length === 0 && (
            <p className="text-xs text-[#57606b]">Nenhuma mensagem ainda. Digite &quot;menu&quot; para começar.</p>
          )}
          {transcript.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${
                m.direction === "inbound" ? "self-end bg-[#dcefe8] text-[#0e5c44]" : "self-start bg-white border border-[#e4dfd2]"
              }`}
            >
              {m.body}
            </div>
          ))}
        </div>

        <form ref={formRef} action={handleSend} className="flex flex-col gap-2">
          <textarea
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Digite como o responsável, ex: "menu" ou "1"'
            className="w-full rounded-md border border-[#cfc8b4] px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex items-center gap-3">
            <input type="file" name="file" accept="application/pdf" className="text-xs" />
            <button type="submit" disabled={isPending} className="btn btn-primary text-xs ml-auto">
              {isPending ? "Enviando…" : "Enviar"}
            </button>
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </form>
      </div>

      <div className="rounded-lg border border-[#cfc8b4] bg-white p-5 space-y-3 h-fit">
        <h3 className="text-sm font-bold">Controles de teste</h3>
        <button
          type="button"
          disabled={isPending}
          className="btn btn-secondary text-xs w-full"
          onClick={() =>
            startTransition(async () => {
              await resetSimulatorConversation();
              window.location.reload();
            })
          }
        >
          Reiniciar conversa
        </button>
        <button
          type="button"
          disabled={isPending}
          className="btn btn-secondary text-xs w-full"
          onClick={() =>
            startTransition(async () => {
              await expireSimulatorWindow();
              window.location.reload();
            })
          }
        >
          Simular janela de 24h expirada
        </button>
        <p className="text-[11px] text-[#57606b]">
          Use isso depois de aprovar um pedido em /supervisao pra ver o comportamento de fora da janela (mensagem
          via template em vez de lista direta).
        </p>
      </div>
    </div>
  );
}
