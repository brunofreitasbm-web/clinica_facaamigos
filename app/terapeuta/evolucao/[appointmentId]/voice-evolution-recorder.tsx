"use client";

import { useRef, useState } from "react";

type VoiceSuggestion = {
  presenca_engajamento: number | null;
  comportamentos: { tipo: string; intensidade: string }[];
  orientacoes: string[];
  free_text: string;
};

/**
 * Gravação de evolução por voz (PRD §9.4 — "evolução em 2 min"). O
 * terapeuta grava um relato curto ao fim da sessão; o áudio vai pra
 * app/api/aba/session-note-voice/route.ts, que transcreve e estrutura via
 * Gemini (lib/gemini.ts). O resultado só PRÉ-PREENCHE os campos do
 * formulário — quem decide salvar continua sendo o fluxo normal
 * (Continuar → revisar texto → Assinar evolução). Nada aqui grava em
 * `session_notes` nem envia o áudio pra lugar nenhum além desta chamada —
 * o áudio não é persistido no navegador nem no servidor (ver route.ts).
 */
export function VoiceEvolutionRecorder({
  onSuggestion,
}: {
  onSuggestion: (suggestion: VoiceSuggestion) => void;
}) {
  const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError(null);
    setApplied(false);

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Gravação de voz não é suportada neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopStream();
        void handleRecordingComplete(recorder.mimeType || "audio/webm");
      };

      recorder.start();
      setStatus("recording");
    } catch (err: unknown) {
      // Erro de permissão (usuário negou o microfone) ou dispositivo
      // indisponível — mensagem clara, sem quebrar o resto do formulário
      // (o terapeuta ainda pode preencher tudo manualmente).
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Permissão de microfone negada. Habilite o microfone nas configurações do navegador ou preencha manualmente.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("Nenhum microfone encontrado neste dispositivo.");
      } else {
        setError("Não foi possível acessar o microfone. Preencha manualmente.");
      }
      setStatus("idle");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  async function handleRecordingComplete(mimeType: string) {
    setStatus("processing");
    setError(null);

    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      if (blob.size === 0) {
        setError("Gravação vazia — tente novamente.");
        setStatus("idle");
        return;
      }

      const audioBase64 = await blobToBase64(blob);

      const res = await fetch("/api/aba/session-note-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(data?.error || "Falha ao transcrever o áudio. Preencha manualmente.");
        setStatus("idle");
        return;
      }

      onSuggestion(data.suggestion as VoiceSuggestion);
      setApplied(true);
      setStatus("idle");
    } catch {
      setError("Falha de conexão ao transcrever o áudio. Preencha manualmente.");
      setStatus("idle");
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-3"
      style={{ borderColor: "var(--color-divider)", background: "var(--color-surface)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Gravar evolução por voz
        </p>
        {status === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-rose-700"
          >
            🎤 Gravar evolução por voz
          </button>
        )}
        {status === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white shadow animate-pulse"
          >
            ⏺ Gravando… toque para parar
          </button>
        )}
        {status === "processing" && (
          <span className="flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">
            Transcrevendo…
          </span>
        )}
      </div>

      <p className="text-[11px] text-ink-soft">
        Fale um relato curto da sessão. A IA sugere presença/engajamento, comportamentos, orientações
        e um texto de evolução — <strong>sempre revise antes de assinar</strong>, é só uma sugestão.
      </p>

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      {applied && !error && (
        <p className="text-xs font-semibold text-emerald-600">
          Sugestão da IA aplicada abaixo — revise os campos antes de continuar.
        </p>
      )}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler o áudio gravado."));
        return;
      }
      // data:audio/webm;base64,AAAA... → mantemos só a parte após a vírgula
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o áudio gravado."));
    reader.readAsDataURL(blob);
  });
}
