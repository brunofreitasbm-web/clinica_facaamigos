"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useOffline } from "next/offline";
import { createSessionNote, setSignaturePin } from "../actions";
import {
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
  GOAL_RESULT_LEVELS,
  type GoalResultLevel,
} from "@/lib/session-note-fields";
import { generateAIEvolutionText } from "@/lib/aba-actions";
import { ABCLogger } from "@/components/aba/abc-logger";
import { InterventionLogger } from "@/components/interventions/intervention-logger";
import type { InterventionCatalogItem } from "@/lib/intervention-catalog";
import { VoiceEvolutionRecorder } from "./voice-evolution-recorder";
import { uploadSessionNoteMedia } from "./media-actions";
import { compressImageIfNeeded } from "@/lib/compress-image";
import { saveDraft, loadDraft, clearDraft } from "@/lib/offline-draft";

const PRESENCE_SCALE = [1, 2, 3, 4, 5] as const;

// Três etapas reais (metas/presença/comportamentos → texto livre + mídia +
// assinatura). A coleta de tentativas por programa (ABA) não fica aqui: é o
// `TrialDataPanel` renderizado antes deste formulário em page.tsx,
// alimentado por `getProgramsForAppointment` (lib/trial-data.ts). Este
// componente cobre presença, metas trabalhadas, comportamentos, orientações,
// mídia e o texto livre gravado em `session_notes.structured`/anexos.

function formatElapsed(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type DraftShape = {
  presence: number | null;
  freeText: string;
  selectedBehaviors: Record<string, boolean>;
  intensities: Record<string, string>;
  selectedOrientations: Record<string, boolean>;
  metas: Record<string, GoalResultLevel | null>;
  openedAt: string;
};

export type EditingContext = {
  previousVersion: number;
  initialPresence: number | null;
  initialBehaviors: Record<string, boolean>;
  initialIntensities: Record<string, string>;
  initialOrientations: Record<string, boolean>;
  initialMetas: Record<string, GoalResultLevel>;
  initialFreeText: string;
};

export type ActiveGoalOption = {
  id: string;
  description: string;
  domain: string;
  discipline: string;
};

type MediaUpload = { id: string; name: string; status: "enviando" | "enviado" | "erro"; error?: string };

export function EvolutionForm({
  appointmentId,
  patientId,
  patientName,
  discipline,
  sessionTime,
  attendanceStartedAt,
  editing,
  pinConfigured,
  activeGoals,
  preCheckedGoalIds,
  behaviorTypes,
  interventionCatalog,
  imageConsent,
  backHref,
  topContent,
}: {
  appointmentId: string;
  patientId: string;
  patientName: string;
  discipline: string;
  sessionTime: string;
  attendanceStartedAt: string | null;
  editing?: EditingContext;
  pinConfigured: boolean;
  activeGoals: ActiveGoalOption[];
  preCheckedGoalIds: string[];
  behaviorTypes: { value: string; label: string }[];
  interventionCatalog: InterventionCatalogItem[];
  imageConsent: boolean;
  /** Pra onde o "← Prontuário de..." do topo volta. Default é a ficha do
   * paciente; quando a entrada veio da agenda (?voltar=agenda&date=), volta
   * pra lá em vez de forçar uma parada na ficha. */
  backHref?: string;
  topContent?: React.ReactNode;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [signed, setSigned] = useState(false);
  const [interventionsCount, setInterventionsCount] = useState<number>(0);
  const [presence, setPresence] = useState<number | null>(editing?.initialPresence ?? null);
  const [selectedBehaviors, setSelectedBehaviors] = useState<Record<string, boolean>>(
    editing?.initialBehaviors ?? {},
  );
  const [intensities, setIntensities] = useState<Record<string, string>>(editing?.initialIntensities ?? {});
  const [selectedOrientations, setSelectedOrientations] = useState<Record<string, boolean>>(
    editing?.initialOrientations ?? {},
  );
  // Metas trabalhadas (PRD §9.4): chave = plan_goal_id marcado, valor =
  // resultado escolhido (null até o terapeuta escolher). Em edição, parte
  // já vem com resultado (initialMetas); em sessão nova, vem pré-marcada com
  // as metas da sessão anterior, sem resultado ainda.
  const [metas, setMetas] = useState<Record<string, GoalResultLevel | null>>(() => {
    if (editing) return { ...editing.initialMetas };
    return Object.fromEntries(preCheckedGoalIds.map((id) => [id, null]));
  });
  const [mediaUploads, setMediaUploads] = useState<MediaUpload[]>([]);
  const [freeText, setFreeText] = useState(editing?.initialFreeText ?? "");
  const [editJustification, setEditJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [elapsedSec, setElapsedSec] = useState(0);
  const [draftSaved, setDraftSaved] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiElapsedSeconds, setAiElapsedSeconds] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const isOffline = useOffline();
  const signaturePinInputRef = useRef<HTMLInputElement>(null);

  const handleFreeTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFreeText(e.target.value);
  }, []);

  // Instante em que o formulário abriu (PRD §9.4 — "medir o tempo entre
  // abrir e assinar"). Fixado uma única vez no mount: restaurar um rascunho
  // NÃO deve reiniciar esse relógio, senão a métrica mentiria a favor do
  // terapeuta. Um rascunho restaurado com `openedAt` próprio sobrescreve
  // este valor (ver efeito de restauração abaixo).
  const [openedAt] = useState(() => new Date().toISOString());
  const draftOpenedAtRef = useRef(openedAt);

  // Assinatura digital por PIN (PRD §9.4). Se o terapeuta ainda não tem
  // PIN configurado, mostramos o cadastro primeiro; depois disso, o PIN é
  // pedido antes de assinar/salvar nova versão.
  const [pinIsConfigured, setPinIsConfigured] = useState(pinConfigured);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinSetupError, setPinSetupError] = useState<string | null>(null);
  const [isSettingUpPin, startPinSetupTransition] = useTransition();
  const [signaturePin, setSignaturePinInput] = useState("");
  // Lazy initializer em vez de efeito: ler localStorage síncrono no mount
  // não precisa de "sincronizar com sistema externo" — só precisa rodar uma
  // vez antes da primeira renderização.
  const [resumingPendingSignature] = useState(() => {
    if (editing) return false;
    try {
      return !!localStorage.getItem(`pending_sign_${appointmentId}`);
    } catch {
      return false;
    }
  });

  function handleSetupPin() {
    setPinSetupError(null);
    startPinSetupTransition(async () => {
      const result = await setSignaturePin(newPin, confirmNewPin);
      if (!result.success) {
        setPinSetupError(result.error);
        return;
      }
      setPinIsConfigured(true);
      setNewPin("");
      setConfirmNewPin("");
    });
  }

  async function handleGenerateAIText() {
    setIsGeneratingAI(true);
    setAiElapsedSeconds(0);
    setAiError(null);
    const interval = setInterval(() => {
      setAiElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const res = await generateAIEvolutionText(appointmentId);
      if (res.success && res.generatedText) {
        setFreeText(res.generatedText);
      } else {
        setAiError(res.error || "Erro ao gerar texto de evolução por IA.");
      }
    } catch {
      setAiError("Falha na chamada da IA.");
    } finally {
      clearInterval(interval);
      setIsGeneratingAI(false);
    }
  }

  // Restaura rascunho salvo (IndexedDB, com migração de um rascunho antigo
  // em localStorage) se existir. Não aplicável a edições — o estado inicial
  // já vem da versão anterior.
  useEffect(() => {
    if (editing) return;

    (async () => {
      let data: DraftShape | null = null;

      // Migração única: um rascunho salvo antes desta versão (localStorage)
      // não pode ser perdido. Lido uma vez e removido.
      try {
        const legacy = localStorage.getItem(`draft_evolution_${appointmentId}`);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          data = {
            presence: parsed.presence ?? null,
            freeText: parsed.freeText ?? "",
            selectedBehaviors: parsed.selectedBehaviors ?? {},
            intensities: parsed.intensities ?? {},
            selectedOrientations: parsed.selectedOrientations ?? {},
            metas: {},
            openedAt,
          };
          localStorage.removeItem(`draft_evolution_${appointmentId}`);
        }
      } catch {}

      if (!data) {
        data = await loadDraft<DraftShape>(`evolution_${appointmentId}`);
      }

      if (data) {
        queueMicrotask(() => {
          if (data!.presence) setPresence(data!.presence);
          if (data!.freeText) setFreeText(data!.freeText);
          if (data!.selectedBehaviors) setSelectedBehaviors(data!.selectedBehaviors);
          if (data!.intensities) setIntensities(data!.intensities);
          if (data!.selectedOrientations) setSelectedOrientations(data!.selectedOrientations);
          if (data!.metas && Object.keys(data!.metas).length > 0) setMetas(data!.metas);
          if (data!.openedAt) draftOpenedAtRef.current = data!.openedAt;
        });
      }
    })();
    // O aviso de "assinatura anterior não confirmada" (marcador
    // pending_sign_*, com experimental.useOffline) é lido no lazy
    // initializer de `resumingPendingSignature` acima, não aqui — evita
    // setState síncrono dentro do efeito.
  }, [appointmentId, editing, openedAt]);

  // Salva alterações em IndexedDB (PRD §9.4 — "rascunho salvo
  // automaticamente a cada campo; funciona offline").
  useEffect(() => {
    if (editing) return;
    if (signed) {
      clearDraft(`evolution_${appointmentId}`);
      try {
        localStorage.removeItem(`pending_sign_${appointmentId}`);
      } catch {}
      return;
    }
    setIsSavingDraft(true);
    const timer = setTimeout(() => {
      saveDraft<DraftShape>(`evolution_${appointmentId}`, {
        presence,
        freeText,
        selectedBehaviors,
        intensities,
        selectedOrientations,
        metas,
        openedAt: draftOpenedAtRef.current,
      }).then(() => {
        setIsSavingDraft(false);
        setDraftSaved(true);
        setDraftSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [presence, freeText, selectedBehaviors, intensities, selectedOrientations, metas, appointmentId, signed, editing]);

  useEffect(() => {
    if (!attendanceStartedAt) return;
    const compute = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(attendanceStartedAt).getTime()) / 1000)));
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [attendanceStartedAt]);

  // Aplica a sugestão da transcrição por voz (rota
  // app/api/aba/session-note-voice/route.ts) aos campos do formulário —
  // NUNCA salva sozinho, só pré-preenche pro terapeuta revisar e depois
  // seguir o fluxo normal (Continuar → texto livre → Assinar evolução).
  function applyVoiceSuggestion(suggestion: {
    presenca_engajamento: number | null;
    comportamentos: { tipo: string; intensidade: string }[];
    orientacoes: string[];
    free_text: string;
  }) {
    if (suggestion.presenca_engajamento !== null) {
      setPresence(suggestion.presenca_engajamento);
      setStepError(null);
    }

    if (suggestion.comportamentos.length > 0) {
      setSelectedBehaviors((prev) => {
        const next = { ...prev };
        for (const c of suggestion.comportamentos) next[c.tipo] = true;
        return next;
      });
      setIntensities((prev) => {
        const next = { ...prev };
        for (const c of suggestion.comportamentos) next[c.tipo] = c.intensidade;
        return next;
      });
    }

    if (suggestion.orientacoes.length > 0) {
      setSelectedOrientations((prev) => {
        const next = { ...prev };
        for (const o of suggestion.orientacoes) next[o] = true;
        return next;
      });
    }

    if (suggestion.free_text) {
      setFreeText((prev) => (prev ? `${prev}\n\n${suggestion.free_text}` : suggestion.free_text));
    }
  }

  function toggleBehavior(value: string) {
    setSelectedBehaviors((prev) => ({ ...prev, [value]: !prev[value] }));
    setIntensities((prev) => (prev[value] ? prev : { ...prev, [value]: "leve" }));
  }

  function toggleOrientation(value: string) {
    setSelectedOrientations((prev) => ({ ...prev, [value]: !prev[value] }));
  }

  function toggleGoal(goalId: string) {
    setMetas((prev) => {
      const next = { ...prev };
      if (goalId in next) {
        delete next[goalId];
      } else {
        next[goalId] = null;
      }
      return next;
    });
  }

  function setGoalResult(goalId: string, level: GoalResultLevel) {
    setMetas((prev) => ({ ...prev, [goalId]: level }));
  }

  async function handleMediaSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const rawFile of Array.from(files)) {
      const uploadId = `${rawFile.name}-${Date.now()}-${Math.random()}`;
      setMediaUploads((prev) => [...prev, { id: uploadId, name: rawFile.name, status: "enviando" }]);
      try {
        const file = await compressImageIfNeeded(rawFile);
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadSessionNoteMedia(appointmentId, patientId, fd);
        setMediaUploads((prev) =>
          prev.map((m) =>
            m.id === uploadId
              ? result.success
                ? { ...m, status: "enviado" }
                : { ...m, status: "erro", error: result.error }
              : m,
          ),
        );
      } catch {
        setMediaUploads((prev) =>
          prev.map((m) => (m.id === uploadId ? { ...m, status: "erro", error: "Falha no envio." } : m)),
        );
      }
    }
  }

  const hasActiveGoals = activeGoals.length > 0;

  function goToStep3() {
    if (presence === null) {
      setStepError("Selecione a presença/engajamento (1 a 5).");
      return;
    }
    if (!hasActiveGoals) {
      setStepError(
        "Este paciente não tem plano terapêutico aprovado com metas ativas. Cadastre/aprove um plano antes de continuar.",
      );
      return;
    }
    const goalsMissingResult = Object.entries(metas).filter(([, resultado]) => !resultado);
    if (goalsMissingResult.length > 0) {
      setStepError("Selecione o resultado de todas as metas marcadas (ou desmarque as que não foram trabalhadas).");
      return;
    }
    setStepError(null);
    setStep(3);
  }

  const behaviorCount = Object.values(selectedBehaviors).filter(Boolean).length;
  const orientationCount = Object.values(selectedOrientations).filter(Boolean).length;
  const goalsWorkedCount = Object.values(metas).filter((v) => !!v).length;
  const mediaDoneCount = mediaUploads.filter((m) => m.status === "enviado").length;

  const stepBg = (n: 1 | 2 | 3) =>
    step >= n || signed ? "var(--color-accent-2)" : "color-mix(in srgb, #fff 25%, transparent)";

  return (
    <>
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-2.5 px-5 pb-4 pt-7 sm:px-10"
      >
        <div className="flex items-center justify-between text-[13px]">
          <Link href={backHref ?? `/terapeuta/paciente/${patientId}`} className="no-underline opacity-90 hover:opacity-100 transition font-medium" style={{ color: "inherit" }}>
            ← Prontuário de {patientName.split(" ")[0]}
          </Link>
          {!signed && (
            <div className="flex items-center gap-3 text-sm opacity-90" role="status" aria-live="polite">
              <span className={`inline-flex items-center gap-1.5 ${isOffline ? "text-amber-300" : "text-emerald-300"}`}>
                {isSavingDraft ? (
                  <>
                    <span className="h-2 w-2 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                    <span>Salvando rascunho...</span>
                  </>
                ) : draftSaved ? (
                  <>
                    <span className={`h-1.5 w-1.5 rounded-full ${isOffline ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <span>
                      {isOffline
                        ? `Salvo apenas no dispositivo ${draftSavedAt ? `(${draftSavedAt})` : ""}`
                        : `Rascunho salvo localmente ${draftSavedAt ? `(${draftSavedAt})` : ""}`}
                    </span>
                  </>
                ) : null}
              </span>
              <span className="flex items-center gap-2 tabular-nums opacity-90">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--color-accent-2)" }} />
                {attendanceStartedAt ? formatElapsed(elapsedSec) : "—:—"}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-sm font-bold text-white uppercase tracking-wider">
              {discipline}
            </span>
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-sm font-medium text-white/90">
              {sessionTime}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-normal text-white/80">
              {signed
                ? editing
                  ? `v${editing.previousVersion + 1}`
                  : "Assinada"
                : editing
                  ? `v${editing.previousVersion + 1}`
                  : "Versão 1"}
            </span>
          </div>
          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="m-0 text-3xl font-bold leading-tight text-white drop-shadow-sm mt-0.5"
          >
            {patientName}
          </h1>
        </div>
        {!signed && (
          <div className="mt-1 flex gap-1">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className="h-[3px] flex-1 rounded-sm"
                style={{ background: stepBg(n as 1 | 2 | 3) }}
              />
            ))}
          </div>
        )}
      </header>

      {signed ? (
        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center gap-4 px-5 py-16 text-center sm:px-10">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{ background: "var(--status-realizada-bg)", color: "var(--status-realizada)" }}
            aria-hidden
          >
            ✓
          </span>
          <p className="text-xl font-semibold text-ink">
            {editing ? "Nova versão registrada" : "Evolução assinada"}
          </p>
          <p className="text-base text-ink-soft">
            {editing
              ? `Versão ${editing.previousVersion + 1} registrada para ${patientName}, mantendo a versão ${editing.previousVersion} no histórico. O registro é append-only — nenhuma versão anterior foi apagada.`
              : `Versão 1 registrada para ${patientName}. O registro é append-only — não pode ser editado por cima.`}
          </p>
          <Link href={`/terapeuta/evolucao/${appointmentId}`} className="btn btn-primary mt-2">
            Voltar para a sessão
          </Link>
        </div>
      ) : (
        <form
          className="mx-auto flex w-full max-w-[640px] md:max-w-[760px] flex-1 flex-col gap-6 px-5 pt-6 sm:px-10"
          style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom, 0px))" }}
          action={(formData) => {
            setError(null);
            formData.set("created_at_device", new Date().toISOString());
            formData.set("opened_at", draftOpenedAtRef.current);
            if (presence !== null) {
              formData.set("presenca_engajamento", String(presence));
            }
            for (const [goalId, resultado] of Object.entries(metas)) {
              if (resultado) formData.set(`meta_${goalId}`, resultado);
            }
            if (editing) {
              if (!editJustification.trim()) {
                setError("Informe o motivo da edição desta evolução.");
                return;
              }
              formData.set("edit_justification", editJustification.trim());
            }
            if (!/^\d{4,6}$/.test(signaturePin)) {
              setError("Informe o PIN de assinatura (4 a 6 dígitos).");
              signaturePinInputRef.current?.focus();
              return;
            }
            formData.set("signature_pin", signaturePin);
            // Marcador de "assinatura em andamento" — se a aba for fechada
            // ou o app for encerrado enquanto esta chamada ainda está
            // pendente (rede fora do ar), este marcador sobra no
            // localStorage e o efeito de restauração acima avisa o
            // terapeuta na próxima visita a esta página, em vez de deixar
            // a assinatura evaporar silenciosamente.
            try {
              localStorage.setItem(`pending_sign_${appointmentId}`, new Date().toISOString());
            } catch {}
            startTransition(async () => {
              const result = await createSessionNote(appointmentId, formData);
              if (!result.success) {
                try {
                  localStorage.removeItem(`pending_sign_${appointmentId}`);
                } catch {}
                setError(result.error || "Não foi possível salvar a evolução. Verifique os campos obrigatórios e tente novamente.");
                if (result.error?.toLowerCase().includes("pin")) {
                  setSignaturePinInput("");
                  signaturePinInputRef.current?.focus();
                }
                return;
              }
              setSigned(true);
            });
          }}
        >
          {topContent}
          {resumingPendingSignature && (
            <div
              className="rounded-md border p-3 text-base"
              style={{ borderColor: "var(--status-agendada)", background: "var(--status-agendada-bg)" }}
            >
              <p className="font-semibold text-ink">Assinatura anterior não confirmada</p>
              <p className="mt-1 text-ink-soft">
                Uma tentativa de assinatura desta sessão foi feita sem conexão e o app foi fechado antes de
                confirmar com o servidor. Os dados abaixo foram restaurados do rascunho local — revise e assine
                novamente.
              </p>
            </div>
          )}

          {/* Passo 1 — intervenções do terapeuta (técnicas aplicadas +
              resposta do paciente): primeira tela ao clicar em "Registrar
              evolução", linha do tempo da sessão que alimenta a síntese de
              texto por IA no passo 3 (generateAIEvolutionText). */}
          <div className={step === 1 ? "flex flex-col gap-6" : "hidden"}>
            <InterventionLogger appointmentId={appointmentId} catalog={interventionCatalog} onLogsChange={setInterventionsCount} />
          </div>

          {/* Passo 2 — presença/engajamento, metas trabalhadas e
              comportamentos-alvo, campos de lib/session-note-fields.ts já
              gravados em session_notes.structured. */}
          <div className={step === 2 ? "flex flex-col gap-6" : "hidden"}>
            <VoiceEvolutionRecorder onSuggestion={applyVoiceSuggestion} />

            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Presença e engajamento
              </p>
              <div className="mt-2 flex gap-2">
                {PRESENCE_SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setPresence(n);
                      setStepError(null);
                    }}
                    className="flex-1 font-semibold"
                    style={{
                      minHeight: 48,
                      borderRadius: "var(--radius-md)",
                      fontFamily: "var(--font-heading)",
                      fontSize: 16,
                      border: `1px solid ${presence === n ? "var(--color-accent)" : "var(--color-divider)"}`,
                      background: presence === n ? "var(--color-accent)" : "var(--color-surface)",
                      color: presence === n ? "#fff" : "var(--color-text)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Metas trabalhadas (PRD §9.4): checkbox das metas ativas do
                plano aprovado do paciente, pré-marcadas com as da sessão
                anterior; cada uma marcada exige um resultado em 4 níveis. */}
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Metas trabalhadas na sessão
              </p>
              {activeGoals.length === 0 ? (
                <div
                  className="mt-2 rounded-md border p-2.5 text-sm"
                  style={{ borderColor: "var(--status-agendada)", background: "var(--status-agendada-bg)" }}
                >
                  <p className="text-ink-faint">
                    Sem plano terapêutico aprovado com metas ativas para este paciente. Não é possível continuar
                    sem uma diretriz terapêutica.
                  </p>
                  <Link
                    href={`/terapeuta/paciente/${patientId}`}
                    className="mt-1 inline-block font-semibold underline"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Cadastrar/aprovar plano terapêutico →
                  </Link>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    Seu rascunho desta evolução é salvo automaticamente e continuará aqui quando você voltar.
                  </p>
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2.5">
                  {activeGoals.map((goal) => {
                    const isChecked = goal.id in metas;
                    return (
                      <div
                        key={goal.id}
                        className="rounded-md border p-2.5"
                        style={{
                          borderColor: isChecked ? "var(--color-accent)" : "var(--color-divider)",
                          background: isChecked ? "var(--color-accent-100)" : "transparent",
                        }}
                      >
                        <label className="flex cursor-pointer items-start gap-2 text-base">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleGoal(goal.id)}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-semibold text-ink">{goal.description}</span>
                            <span className="ml-1.5 text-sm text-ink-faint">
                              {goal.domain} · {goal.discipline}
                            </span>
                          </span>
                        </label>
                        {isChecked && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {GOAL_RESULT_LEVELS.map((r) => {
                              const selected = metas[goal.id] === r.value;
                              return (
                                <button
                                  key={r.value}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => setGoalResult(goal.id, r.value)}
                                  className={`inline-flex items-center gap-1 min-h-[44px] rounded-md px-3 py-1 text-sm font-bold transition-all border ${
                                    selected
                                      ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/30"
                                      : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:border-slate-400 hover:text-slate-900"
                                  }`}
                                >
                                  {selected && <span className="text-sm font-black">✓</span>}
                                  {r.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Comportamentos-alvo observados
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {behaviorTypes.map((b) => (
                  <div key={b.value} className="flex flex-wrap items-center gap-2.5">
                    <label
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-base"
                      style={{
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${selectedBehaviors[b.value] ? "var(--color-accent)" : "var(--color-divider)"}`,
                        background: selectedBehaviors[b.value] ? "var(--color-accent-100)" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        name="comportamento_tipo"
                        value={b.value}
                        checked={!!selectedBehaviors[b.value]}
                        onChange={() => toggleBehavior(b.value)}
                        className="sr-only"
                      />
                      {b.label}
                    </label>
                    {selectedBehaviors[b.value] && (
                      <div className="seg">
                        {BEHAVIOR_INTENSITIES.map((i) => (
                          <label key={i.value} className="seg-opt">
                            <input
                              type="radio"
                              name={`comportamento_intensidade_${b.value}`}
                              value={i.value}
                              checked={intensities[b.value] === i.value}
                              onChange={() => setIntensities((prev) => ({ ...prev, [b.value]: i.value }))}
                            />
                            {i.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Orientação dada à família
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FAMILY_GUIDANCE_OPTIONS.map((g) => (
                  <label
                    key={g.value}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-base min-h-[44px]"
                    style={{
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${selectedOrientations[g.value] ? "var(--color-accent-2)" : "var(--color-divider)"}`,
                      background: selectedOrientations[g.value] ? "var(--color-accent-2-100)" : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="orientacao"
                      value={g.value}
                      checked={!!selectedOrientations[g.value]}
                      onChange={() => toggleOrientation(g.value)}
                      className="sr-only"
                    />
                    {g.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Registro Funcional ABC (Antecedente - Comportamento - Consequência) */}
            <ABCLogger appointmentId={appointmentId} />

            {stepError && <p className="text-sm text-status-negative-text">{stepError}</p>}
          </div>

          {/* Passo 3 — mídia, texto livre + resumo antes de assinar. */}
          <div className={step === 3 ? "flex flex-col gap-6" : "hidden"}>
            {/* Anexo de foto/vídeo (PRD §9.4), condicionado ao consentimento
                de imagem do responsável (guardians.image_consent) — o banco
                também recusa via trigger caso a UI seja contornada. */}
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                Foto ou vídeo curto (opcional)
              </p>
              {imageConsent ? (
                <div className="mt-2 flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    multiple
                    onChange={(e) => {
                      handleMediaSelected(e.target.files);
                      e.target.value = "";
                    }}
                    className="text-base"
                  />
                  {mediaUploads.length > 0 && (
                    <ul className="flex flex-col gap-1 text-sm">
                      {mediaUploads.map((m) => (
                        <li key={m.id} className={m.status === "erro" ? "text-status-negative-text" : "text-ink-soft"}>
                          {m.name} — {m.status === "enviando" ? "enviando…" : m.status === "enviado" ? "enviado" : m.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">
                  A família não autorizou uso de imagem para este paciente — anexo de foto/vídeo desabilitado.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium uppercase tracking-wide text-ink-soft" htmlFor="free_text">
                  Texto livre de Evolução Clínica
                </label>
                <button
                  type="button"
                  onClick={handleGenerateAIText}
                  disabled={isGeneratingAI}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {isGeneratingAI ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Sintetizando ({aiElapsedSeconds}s)...
                    </span>
                  ) : (
                    "✨ Gerar Texto com IA (1-Clique)"
                  )}
                </button>
              </div>

              {isGeneratingAI && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 animate-fade-in space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    <span>Processando tentativas, metas e comportamentos da sessão...</span>
                    <span>{aiElapsedSeconds}s</span>
                  </div>
                  <div className="h-1.5 w-full bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-500"
                      style={{ width: `${Math.min(aiElapsedSeconds * 10, 95)}%` }}
                    />
                  </div>
                </div>
              )}

              <textarea
                id="free_text"
                name="free_text"
                rows={6}
                value={freeText}
                onChange={handleFreeTextChange}
                placeholder="Preencha observações clínicas ou clique no botão acima para sintetizar as tentativas e registros da sessão com Inteligência Artificial..."
                className="input mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              {aiError && <p className="text-sm font-semibold text-rose-600 mt-1">{aiError}</p>}
            </div>

            {editing && (
              <div className="space-y-2">
                <label className="text-sm font-medium uppercase tracking-wide text-ink-soft" htmlFor="edit_justification">
                  Motivo da edição (obrigatório)
                </label>
                <textarea
                  id="edit_justification"
                  name="edit_justification"
                  rows={3}
                  value={editJustification}
                  onChange={(e) => setEditJustification(e.target.value)}
                  placeholder="Por que esta evolução está sendo corrigida?"
                  className="input mt-2"
                />
              </div>
            )}

            {pinIsConfigured ? (
              <div className="space-y-2">
                <label className="text-sm font-medium uppercase tracking-wide text-ink-soft" htmlFor="signature_pin_input">
                  PIN de assinatura
                </label>
                <div className="relative flex items-center max-w-[200px]">
                  <input
                    ref={signaturePinInputRef}
                    id="signature_pin_input"
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={signaturePin}
                    onChange={(e) => setSignaturePinInput(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => setCapsLockActive(e.getModifierState("CapsLock"))}
                    placeholder="••••"
                    className="input w-full pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    style={{ letterSpacing: "0.3em" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="absolute right-2 p-2.5 text-sm text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                    aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                    title={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                  >
                    {showPin ? "👁️" : "🙈"}
                  </button>
                </div>
                {capsLockActive && (
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                    <span>⚠️</span> Caps Lock está ativado
                  </p>
                )}
              </div>
            ) : (
              <div className="card flex flex-col gap-2.5">
                <div className="card-kicker">Configure seu PIN de assinatura</div>
                <p className="text-sm text-ink-soft">
                  Você ainda não tem um PIN cadastrado. Crie um PIN de 4 a 6 dígitos para confirmar sua identidade ao assinar evoluções.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Novo PIN"
                    className="input"
                    style={{ maxWidth: 140, letterSpacing: "0.3em" }}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Confirmar PIN"
                    className="input"
                    style={{ maxWidth: 140, letterSpacing: "0.3em" }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isSettingUpPin}
                    onClick={handleSetupPin}
                  >
                    {isSettingUpPin ? "Salvando…" : "Salvar PIN"}
                  </button>
                </div>
                {pinSetupError && <p className="text-sm text-status-negative-text">{pinSetupError}</p>}
              </div>
            )}

            <div className="card">
              <div className="card-kicker">
                {editing ? "Resumo antes de salvar a nova versão" : "Resumo antes de assinar"}
              </div>
              <div className="flex flex-col gap-1 text-base text-ink">
                <span>Presença/engajamento: {presence ?? "—"}/5</span>
                <span>
                  Metas trabalhadas: {goalsWorkedCount} de {activeGoals.length}
                </span>
                <span>
                  Comportamentos-alvo: {behaviorCount > 0 ? behaviorCount : "nenhum registrado"}
                </span>
                <span>
                  Orientações à família: {orientationCount > 0 ? orientationCount : "nenhuma registrada"}
                </span>
                <span>Anexos: {mediaDoneCount}</span>
                <span>Versão: {editing ? editing.previousVersion + 1 : 1}</span>
              </div>
            </div>

            {error && (
              <div
                className="rounded-md border p-3 text-sm flex items-start gap-2 shadow-sm animate-fade-in"
                style={{
                  borderColor: "var(--status-falta)",
                  background: "var(--status-falta-bg)",
                  color: "var(--color-status-negative-text)"
                }}
                role="alert"
              >
                <span className="font-bold text-base">⚠️</span>
                <div>
                  <p className="font-bold">Não foi possível salvar a evolução.</p>
                  <p className="mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>

          <div
            className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 bg-white px-5 pt-3 sm:px-10"
            style={{
              borderTop: "1px solid var(--color-divider)",
              paddingBottom: "calc(1.75rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {step !== 1 && (
              <button
                type="button"
                className="btn btn-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ minHeight: 48 }}
                onClick={() => setStep(step === 3 ? 2 : 1)}
              >
                Voltar
              </button>
            )}
            {step === 1 && (
              <button
                type="button"
                className="btn btn-primary flex-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  minHeight: 48,
                  fontSize: 15,
                  opacity: interventionsCount === 0 ? 0.5 : 1,
                  cursor: interventionsCount === 0 ? "not-allowed" : "pointer",
                }}
                disabled={interventionsCount === 0}
                title={interventionsCount === 0 ? "Registre ao menos 1 intervenção para continuar" : undefined}
                onClick={() => setStep(2)}
              >
                Continuar
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                className="btn btn-primary flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  minHeight: 48,
                  fontSize: 15,
                  opacity: hasActiveGoals ? 1 : 0.5,
                  cursor: hasActiveGoals ? "pointer" : "not-allowed",
                }}
                disabled={!hasActiveGoals}
                title={
                  hasActiveGoals
                    ? undefined
                    : "Cadastre/aprove um plano terapêutico com metas ativas para este paciente antes de continuar"
                }
                onClick={goToStep3}
              >
                Continuar
              </button>
            )}
            {step === 3 && (
              <button
                type="submit"
                className="btn btn-gold flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                style={{ minHeight: 48, fontSize: 15 }}
                disabled={isPending || !pinIsConfigured}
              >
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    {isOffline
                      ? "Sem conexão — enviando quando a internet voltar…"
                      : editing
                        ? "Salvando nova versão…"
                        : "Salvando evolução…"}
                  </span>
                ) : editing ? (
                  "Salvar nova versão"
                ) : (
                  "Assinar evolução"
                )}
              </button>
            )}
          </div>
        </form>
      )}
    </>
  );
}
