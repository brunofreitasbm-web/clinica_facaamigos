"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Sparkles, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";

type VoiceSuggestion = {
  presenca_engajamento: number | null;
  comportamentos: { tipo: string; intensidade: string }[];
  orientacoes: string[];
  free_text: string;
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Gravação de evolução por voz (PRD §9.4 — "evolução em 2 min").
 * Redesenhada para máxima visibilidade, ergonomia mobile/tablet e clareza de uso.
 */
export function VoiceEvolutionRecorder({
  onSuggestion,
}: {
  onSuggestion: (suggestion: VoiceSuggestion) => void;
}) {
  const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 25, 10, 30, 20]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      stopStream();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) void audioContextRef.current.close();
    };
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }

  function setupAudioVisualizer(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        analyser.getByteFrequencyData(dataArray);
        // Pega 5 amostras representativas do espectro
        const samples = [
          Math.max(10, Math.min(100, (dataArray[1] || 0) / 2.5)),
          Math.max(15, Math.min(100, (dataArray[3] || 0) / 2.2)),
          Math.max(10, Math.min(100, (dataArray[5] || 0) / 2.0)),
          Math.max(15, Math.min(100, (dataArray[7] || 0) / 2.2)),
          Math.max(10, Math.min(100, (dataArray[9] || 0) / 2.5)),
        ];
        setAudioLevels(samples);
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
    } catch {
      // Caso haja restrição no navegador, mantém barras animadas estáticas
    }
  }

  async function startRecording() {
    setError(null);
    setApplied(false);
    setRecordingSeconds(0);

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
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        stopStream();
        void handleRecordingComplete(recorder.mimeType || "audio/webm");
      };

      recorder.start();
      setStatus("recording");

      // Inicia visualizador em tempo real
      setupAudioVisualizer(stream);

      // Inicia o cronômetro
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Permissão de microfone negada. Habilite o acesso ao microfone no navegador ou preencha manualmente.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("Nenhum microfone foi encontrado neste dispositivo.");
      } else {
        setError("Não foi possível conectar ao microfone. Você pode preencher os campos manualmente.");
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
        setError("A gravação ficou vazia. Por favor, tente falar novamente.");
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
        setError(data?.error || "Não foi possível interpretar o áudio gravado. Preencha os campos manualmente.");
        setStatus("idle");
        return;
      }

      onSuggestion(data.suggestion as VoiceSuggestion);
      setApplied(true);
      setStatus("idle");
    } catch {
      setError("Falha de conexão ao transcrever o relato por voz. Preencha manualmente.");
      setStatus("idle");
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-200/80 bg-gradient-to-br from-purple-50/60 via-rose-50/30 to-indigo-50/50 p-4 shadow-sm dark:border-purple-800/40 dark:from-purple-950/30 dark:via-slate-900/40 dark:to-indigo-950/30">
      {/* Decoração sutil de fundo */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-400/10 blur-2xl dark:bg-purple-600/10" />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Cabeçalho do Card */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
              <Sparkles className="h-3 w-3" /> Ditado Inteligente IA
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Evolução em 2 minutos
          </span>
        </div>

        {/* Estado Neutro (Pronto para Gravar) */}
        {status === "idle" && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-purple-300/80 bg-white/70 p-4 text-center dark:border-purple-700/50 dark:bg-slate-900/60">
            <div className="group relative mb-2 flex items-center justify-center">
              {/* Animação suave ao passar o mouse */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-rose-600 opacity-30 blur transition duration-300 group-hover:opacity-60" />
              <button
                type="button"
                onClick={startRecording}
                className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-md transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-300 dark:focus:ring-purple-800"
                title="Clique para iniciar o ditado da evolução"
              >
                <Mic className="h-7 w-7" />
              </button>
            </div>

            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Toque para ditar o relato da sessão
            </h4>
            <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">
              Fale livremente como foi o atendimento. A inteligência artificial identificará o engajamento, comportamentos observados e organizará a narrativa automaticamente.
            </p>
          </div>
        )}

        {/* Estado Gravando (Ativo com Timer e Visualizador de Áudio) */}
        {status === "recording" && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-rose-300 bg-rose-50/80 p-4 text-center shadow-inner dark:border-rose-800/60 dark:bg-rose-950/40">
            {/* Halo Pulsante Vermelho */}
            <div className="relative mb-3 flex items-center justify-center">
              <span className="absolute h-16 w-16 animate-ping rounded-full bg-rose-400/40 dark:bg-rose-500/30" />
              <button
                type="button"
                onClick={stopRecording}
                className="relative flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition hover:bg-rose-700 active:scale-95 focus:outline-none"
                title="Clique para concluir a gravação"
              >
                <Square className="h-6 w-6 fill-current" />
              </button>
            </div>

            {/* Timer e Rótulo de Gravação */}
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
              <span className="text-sm font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Gravando áudio
              </span>
              <span className="font-mono text-lg font-extrabold text-slate-900 dark:text-white">
                {formatDuration(recordingSeconds)}
              </span>
            </div>

            {/* Visualizador de Barras de Áudio */}
            <div className="mt-3 flex h-8 items-end justify-center gap-1.5 px-4">
              {audioLevels.map((lvl, idx) => (
                <div
                  key={idx}
                  className="w-1.5 rounded-full bg-rose-500 transition-all duration-75 dark:bg-rose-400"
                  style={{ height: `${Math.max(15, lvl)}%` }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={stopRecording}
              className="mt-3 rounded-lg bg-rose-700 px-4 py-1.5 text-sm font-bold text-white shadow hover:bg-rose-800 transition"
            >
              ⏹ Concluir e Analisar com IA
            </button>
          </div>
        )}

        {/* Estado Processando (IA Análise) */}
        {status === "processing" && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-purple-200 bg-white/80 p-5 text-center dark:border-purple-800 dark:bg-slate-900/80">
            <div className="relative mb-2 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
              <Sparkles className="absolute h-4 w-4 text-rose-500" />
            </div>
            <h4 className="text-base font-bold text-purple-900 dark:text-purple-300">
              O Gemini está estruturando sua evolução...
            </h4>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Extraindo engajamento, comportamentos e gerando o relato textual.
            </p>
          </div>
        )}

        {/* Notificação de Sucesso */}
        {applied && !error && status === "idle" && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-sm font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Sugestão da IA aplicada!</strong> Revise a presença, comportamentos e o texto abaixo antes de continuar.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setApplied(false)}
              className="text-[11px] font-bold underline hover:opacity-80 ml-2 shrink-0"
            >
              OK
            </button>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="flex items-center justify-between rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-sm font-medium text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-1 rounded bg-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-900 hover:bg-rose-300 dark:bg-rose-900 dark:text-rose-100"
            >
              <RefreshCw className="h-3 w-3" /> Tentar novamente
            </button>
          </div>
        )}
      </div>
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

