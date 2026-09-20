"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Loader2, Bot } from "lucide-react";
import { reprocessRegistrationDraft } from "../actions";

export function DraftProcessingPoller({ draftId, status }: { draftId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Poll a cada 3 segundos para atualizar a página automaticamente
    const interval = setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [router]);

  const handleManualRefresh = () => {
    setErrorMsg(null);
    startTransition(() => {
      router.refresh();
    });
  };

  const handleForceReprocess = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await reprocessRegistrationDraft(draftId);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-paper-line-strong bg-paper/80 p-8 text-center shadow-sm backdrop-blur-sm">
      <div className="relative mb-5 flex items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent shadow-inner">
          <Sparkles className="h-8 w-8 animate-pulse text-accent" />
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <Bot className="h-5 w-5 text-accent" />
        <h3 className="text-base font-semibold text-ink">
          A IA está lendo os documentos do pré-cadastro
        </h3>
      </div>

      <p className="mb-6 max-w-md text-sm text-ink-soft leading-relaxed">
        {status === "processing"
          ? "Os arquivos enviados pelo responsável estão sendo analisados e os campos do cadastro extraídos pela IA. A página atualizará automaticamente assim que concluir."
          : "O pré-cadastro está na fila. A IA está iniciando a leitura e extração das informações."}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-semibold text-accent-contrast shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar página agora
        </button>

        <button
          type="button"
          onClick={handleForceReprocess}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-paper-line-strong bg-paper px-4 py-2.5 text-xs font-medium text-ink transition hover:bg-paper-line/40 disabled:opacity-50"
        >
          Forçar leitura da IA
        </button>
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-md border border-status-negative-text/20 bg-status-negative-text/10 px-3 py-2 text-xs font-medium text-status-negative-text">
          {errorMsg}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-ink-faint">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Atualização automática em tempo real ativa
      </div>
    </div>
  );
}
