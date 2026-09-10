"use client";

import React, { useId, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTreatmentPlan } from "./actions";
import { DISCIPLINES } from "./disciplines";
import type { SuggestedGoal, TeamSuggestion } from "@/lib/plan-suggestions";
import { PTSCalendarView } from "./pts-calendar-view";
import { PTSPrintableCalendar, type CalendarSessionEvent } from "./pts-printable-calendar";
import { PtsTemplateModal } from "./pts-template-modal";
import { extractAutocompleteSuggestions, type PtsTemplate } from "@/lib/pts-templates";
import { fetchPtsTemplatesAction, saveGoalAsTemplateAction } from "@/app/supervisao/pts-template-actions";
import type { ClinicIdentity } from "@/lib/clinic-identity";
import { generate40MinSlotsForShift } from "@/lib/pts-slots";
import { GoalForm } from "@/components/SmartGoals/GoalForm";


type Patient = { id: string; full_name: string };
type Therapist = { id: string; full_name: string };
type Room = { id: string; name: string };
type AvailabilityBlock = { profile_id: string; day_of_week: number; start_time: string; end_time: string };

type ProgramTargetType = "tentativa" | "duracao" | "frequencia" | "tarefa";

export type DayOfWeek = "SEG" | "TER" | "QUA" | "QUI" | "SEX" | "SAB";

export type PTSGridRow = {
  id: string;
  discipline: string;
  sessionsPerWeek: number;
  daysOfWeek: DayOfWeek[];
  shift: "MANHA" | "TARDE" | "NOITE";
  preferredSlot?: string;
  therapistId: string;
};

export { generate40MinSlotsForShift };

const DAY_LABELS: Record<DayOfWeek, string> = {
  SEG: "Seg",
  TER: "Ter",
  QUA: "Qua",
  QUI: "Qui",
  SEX: "Sex",
  SAB: "Sáb",
};

const TARGET_TYPE_LABEL: Record<ProgramTargetType, string> = {
  tentativa: "Tentativa (trial)",
  duracao: "Duração",
  frequencia: "Frequência",
  tarefa: "Tarefa (checklist)",
};

/**
 * Um "programa" ABA = alvo de coleta de dados por tentativa dentro de uma
 * meta (tabela `programs`, 20260904000005_treatment_plans.sql). Precisa de
 * ou um item de protocolo licenciado (`protocolItemId`, quando a meta veio
 * de uma sugestão de avaliação) ou um domínio livre (quando adicionado
 * manualmente — vira `domain_taxonomy` no server, ver actions.ts).
 */
type Program = {
  key: string;
  name: string;
  targetType: ProgramTargetType;
  masteryCriterion: string;
  protocolItemId: string | null;
  itemCode?: string;
};

type Goal = {
  key: string;
  discipline: string;
  domain: string;
  description: string;
  baseline: string;
  target: string;
  criterion: string;
  horizon: string;
  strategy: string;
  methodology: string;
  programs: Program[];
};

function emptyGoal(): Goal {
  return {
    key: crypto.randomUUID(),
    discipline: "",
    domain: "",
    description: "",
    baseline: "",
    target: "",
    criterion: "",
    horizon: "",
    strategy: "",
    methodology: "",
    programs: [],
  };
}

function emptyProgram(): Program {
  return { key: crypto.randomUUID(), name: "", targetType: "tentativa", masteryCriterion: "", protocolItemId: null };
}

const inputClass =
  "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

export function PlanForm({
  patients,
  therapists = [],
  rooms = [],
  availability = [],
  initialPatientId = "",
  initialFamilyPriorities = "",
  suggestedGoals = [],
  teamSuggestions = [],
  clinic,
}: {
  patients: Patient[];
  therapists?: Therapist[];
  rooms?: Room[];
  availability?: AvailabilityBlock[];
  initialPatientId?: string;
  initialFamilyPriorities?: string;
  suggestedGoals?: SuggestedGoal[];
  teamSuggestions?: TeamSuggestion[];
  clinic: ClinicIdentity;
}) {
  const formId = useId();
  const router = useRouter();
  // Pré-seleção via ?paciente= (atalho "Montar PTS" da aba Fluxos da supervisão);
  // só vale se o id estiver na lista elegível (ativo/avaliacao).
  const [patientId, setPatientId] = useState(() =>
    patients.some((p) => p.id === initialPatientId) ? initialPatientId : "",
  );
  const [reviewDueAt, setReviewDueAt] = useState("");
  const [generalObjective, setGeneralObjective] = useState("");
  const [familyPriorities, setFamilyPriorities] = useState(initialFamilyPriorities);
  // Equipe de avaliação já definida (Módulo 3 MAAIS, slide 23) pré-marca as
  // disciplinas do plano assim que a página carrega — o supervisor só
  // precisa preencher sessões/semana, não redigitar quem já está na equipe.
  const [selectedDisciplines, setSelectedDisciplines] = useState<Record<string, string>>(() =>
    Object.fromEntries(teamSuggestions.map((t) => [t.discipline, "1"])),
  );
  const [goals, setGoals] = useState<Goal[]>([emptyGoal()]);
  const [addedSuggestionKeys, setAddedSuggestionKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Templates do PTS & Autocompletes
  const [allTemplates, setAllTemplates] = useState<PtsTemplate[]>([]);
  const [activeModalGoalKey, setActiveModalGoalKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPtsTemplatesAction().then((data) => setAllTemplates(data));
  }, []);

  const autocompleteOptions = React.useMemo(() => {
    return extractAutocompleteSuggestions(allTemplates);
  }, [allTemplates]);

  function applyTemplateToGoal(goalKey: string, template: PtsTemplate) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.key !== goalKey) return g;
        const programs: Program[] =
          template.discipline === "aba" && template.programs_default?.length > 0
            ? template.programs_default.map((p) => ({
                key: crypto.randomUUID(),
                name: p.name,
                targetType: p.targetType || "tentativa",
                masteryCriterion: p.masteryCriterion || "",
                protocolItemId: null,
              }))
            : g.programs;

        return {
          ...g,
          discipline: template.discipline,
          domain: template.domain,
          description: template.description,
          baseline: template.baseline || g.baseline,
          strategy: template.strategy || g.strategy,
          criterion: template.criterion || g.criterion,
          horizon: template.horizon || g.horizon,
          methodology: template.methodology || g.methodology,
          programs,
        };
      })
    );
    setToastMessage(`Template "${template.title}" aplicado na meta!`);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function handleSaveGoalAsTemplate(goal: Goal) {
    if (!goal.discipline || !goal.domain.trim() || !goal.description.trim()) {
      setError("Para salvar como template, preencha Disciplina, Domínio e Meta (descrição).");
      return;
    }
    const result = await saveGoalAsTemplateAction({
      discipline: goal.discipline,
      domain: goal.domain,
      description: goal.description,
      baseline: goal.baseline,
      strategy: goal.strategy,
      criterion: goal.criterion,
      horizon: goal.horizon,
      methodology: goal.methodology,
      programs: goal.programs,
    });
    if (result.success) {
      setToastMessage("⭐ Meta salva como template no banco da clínica!");
      fetchPtsTemplatesAction().then((data) => setAllTemplates(data));
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setError(result.error);
    }
  }

  // Grade semanal dinâmica de atendimento
  const [gridRows, setGridRows] = useState<PTSGridRow[]>([
    {
      id: crypto.randomUUID(),
      discipline: "terapia",
      sessionsPerWeek: 2,
      daysOfWeek: ["SEG", "QUA"],
      shift: "MANHA",
      therapistId: "",
    },
  ]);

  // Calendário Conciliado de 6 Meses
  const [generatedSessions, setGeneratedSessions] = useState<CalendarSessionEvent[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Sessões que o gerador não conseguiu encaixar automaticamente (sem
  // terapeuta direcionado, sem horário livre, ou sem sala livre). Sem esse
  // aviso o supervisor só descobria depois de salvar, num plano com meses de
  // sessões (ver mensagem de erro em actions.ts) — precisa reconhecer
  // explicitamente antes de salvar mesmo assim.
  const manualSessionsCount = generatedSessions.filter((s) => s.conflictStatus === "MANUAL_REQUIRED").length;
  const [acknowledgeManualSessions, setAcknowledgeManualSessions] = useState(false);
  useEffect(() => {
    setAcknowledgeManualSessions(false);
  }, [generatedSessions]);
  const [startDateStr, setStartDateStr] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  // Calcula validade de 6 meses
  const validUntilStr = React.useMemo(() => {
    const d = new Date(startDateStr + "T00:00:00");
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().substring(0, 10);
  }, [startDateStr]);

  function addGridRow() {
    setGridRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        discipline: "fonoaudiologia",
        sessionsPerWeek: 1,
        daysOfWeek: ["TER"],
        shift: "TARDE",
        therapistId: "",
      },
    ]);
  }

  function removeGridRow(id: string) {
    setGridRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function updateGridRow<K extends keyof PTSGridRow>(id: string, field: K, value: PTSGridRow[K]) {
    setGridRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function toggleDayOfWeek(rowId: string, day: DayOfWeek) {
    setGridRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const exists = r.daysOfWeek.includes(day);
        const newDays = exists ? r.daysOfWeek.filter((d) => d !== day) : [...r.daysOfWeek, day];
        return { ...r, daysOfWeek: newDays };
      })
    );
  }

  // Atualização manual de sessão pelo supervisor
  function handleUpdateSession(updatedSession: CalendarSessionEvent) {
    setGeneratedSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
  }

  // Gera slots de 40min dentro de uma janela real de disponibilidade
  // (HH:mm-HH:mm), no mesmo formato de generate40MinSlotsForShift.
  function generate40MinSlotsInRange(startTime: string, endTime: string): string[] {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const slots: string[] = [];
    let currentMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (currentMin + 40 <= endMin) {
      const sH = String(Math.floor(currentMin / 60)).padStart(2, "0");
      const sM = String(currentMin % 60).padStart(2, "0");
      const eMin = currentMin + 40;
      const eH = String(Math.floor(eMin / 60)).padStart(2, "0");
      const eM = String(eMin % 60).padStart(2, "0");
      slots.push(`${sH}:${sM} - ${eH}:${eM}`);
      currentMin += 40;
    }
    return slots;
  }

  function shiftForHour(hour: number): "MANHA" | "TARDE" | "NOITE" {
    if (hour < 12) return "MANHA";
    if (hour < 17) return "TARDE";
    return "NOITE";
  }

  // Algoritmo de Conciliação: aloca terapeuta/sala reais dentro da janela de
  // disponibilidade real (professional_availability) e da ocupação já usada
  // por esta mesma geração. O bloqueio definitivo contra sobreposição real
  // (outros appointments já existentes, ou fora do expediente) acontece no
  // banco no momento de salvar (actions.ts / trigger
  // appointments_availability_guard) — aqui só evitamos gerar um calendário
  // obviamente inviável.
  function handleGenerateCalendar() {
    const selectedPatient = patients.find((p) => p.id === patientId);
    if (!selectedPatient) {
      setError("Selecione um paciente antes de gerar o calendário de sessões.");
      return;
    }

    setError(null);
    const sessionsList: CalendarSessionEvent[] = [];
    const startDate = new Date(startDateStr + "T00:00:00");
    const endDate = new Date(validUntilStr + "T00:00:00");

    const dayMap: Record<DayOfWeek, number> = {
      SEG: 1,
      TER: 2,
      QUA: 3,
      QUI: 4,
      SEX: 5,
      SAB: 6,
    };

    // Fallback: terapeuta sem NENHUMA disponibilidade cadastrada ainda
    // (mesma semântica de "não configurado" do trigger no banco) usa os
    // turnos fixos como antes, só pra dar uma sugestão inicial.
    const fixedShiftSlots: Record<"MANHA" | "TARDE" | "NOITE", string[]> = {
      MANHA: generate40MinSlotsForShift("MANHA"),
      TARDE: generate40MinSlotsForShift("TARDE"),
      NOITE: generate40MinSlotsForShift("NOITE"),
    };

    const availabilityByTherapist = new Map<string, AvailabilityBlock[]>();
    availability.forEach((b) => {
      const list = availabilityByTherapist.get(b.profile_id) || [];
      list.push(b);
      availabilityByTherapist.set(b.profile_id, list);
    });

    // Ocupação (terapeuta e sala) já usada nesta geração, por data.
    const occupiedTherapistSlots = new Map<string, Set<string>>();
    const occupiedRoomSlots = new Map<string, Set<string>>();

    let curr = new Date(startDate);
    let sessionCounter = 1;

    while (curr <= endDate) {
      const currentJsDay = curr.getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb
      const dateIso = curr.toISOString().substring(0, 10);

      gridRows.forEach((row) => {
        const matchingDays = row.daysOfWeek.map((d) => dayMap[d]);
        if (matchingDays.includes(currentJsDay)) {
          const discLabel = DISCIPLINES.find((d) => d.value === row.discipline)?.label || row.discipline;
          const dayName = curr.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase();
          const therapistId = row.therapistId || null;
          const therapistName = therapists.find((t) => t.id === therapistId)?.full_name;

          let conflictStatus: CalendarSessionEvent["conflictStatus"] = "OK";
          let conflictNote = "";
          let assignedTimeSlot = "";
          let assignedShift = row.shift;
          let roomId: string | null = null;
          let roomName: string | undefined;

          if (!therapistId) {
            conflictStatus = "MANUAL_REQUIRED";
            conflictNote = "Selecione um terapeuta direcionado para esta linha antes de salvar o plano.";
            assignedTimeSlot = fixedShiftSlots[row.shift][0] || "";
          } else {
            const therapistBlocks = availabilityByTherapist.get(therapistId) || [];
            const hasAnyAvailabilityConfigured = availability.some((b) => b.profile_id === therapistId);
            const dayBlocks = therapistBlocks.filter((b) => b.day_of_week === currentJsDay);

            let candidateSlots: string[];
            if (dayBlocks.length > 0) {
              candidateSlots = dayBlocks.flatMap((b) => generate40MinSlotsInRange(b.start_time.slice(0, 5), b.end_time.slice(0, 5)));
            } else if (!hasAnyAvailabilityConfigured) {
              // Terapeuta ainda sem disponibilidade cadastrada — sugere pelo
              // turno escolhido, mas sinaliza que precisa ser configurada.
              candidateSlots = fixedShiftSlots[row.shift];
            } else {
              candidateSlots = [];
            }

            if (row.preferredSlot && candidateSlots.includes(row.preferredSlot)) {
              candidateSlots = [row.preferredSlot, ...candidateSlots.filter((s) => s !== row.preferredSlot)];
            }

            const therapistOccupied = occupiedTherapistSlots.get(dateIso) || new Set<string>();

            for (const slotCandidate of candidateSlots) {
              const key = `${therapistId}_${slotCandidate}`;
              if (!therapistOccupied.has(key)) {
                assignedTimeSlot = slotCandidate;
                assignedShift = shiftForHour(Number(slotCandidate.slice(0, 2)));
                therapistOccupied.add(key);
                break;
              }
            }
            occupiedTherapistSlots.set(dateIso, therapistOccupied);

            if (!assignedTimeSlot) {
              conflictStatus = "MANUAL_REQUIRED";
              conflictNote = dayBlocks.length === 0 && hasAnyAvailabilityConfigured
                ? "Terapeuta sem disponibilidade cadastrada para este dia da semana."
                : "Terapeuta sem horário livre nesta data — todos os slots já usados neste calendário.";
              assignedTimeSlot = candidateSlots[0] || fixedShiftSlots[row.shift][0] || "";
            } else if (!hasAnyAvailabilityConfigured) {
              conflictNote = "Terapeuta ainda sem disponibilidade cadastrada em /supervisao/disponibilidade — horário sugerido, não garantido.";
            }

            // Aloca sala real por rotação simples entre as salas livres
            // naquele slot.
            if (assignedTimeSlot && rooms.length > 0) {
              const roomOccupied = occupiedRoomSlots.get(dateIso) || new Set<string>();
              for (let i = 0; i < rooms.length; i++) {
                const candidateRoom = rooms[(sessionCounter + i) % rooms.length];
                const key = `${candidateRoom.id}_${assignedTimeSlot}`;
                if (!roomOccupied.has(key)) {
                  roomId = candidateRoom.id;
                  roomName = candidateRoom.name;
                  roomOccupied.add(key);
                  break;
                }
              }
              occupiedRoomSlots.set(dateIso, roomOccupied);
              if (!roomId) {
                conflictStatus = "MANUAL_REQUIRED";
                conflictNote = conflictNote || "Nenhuma sala livre neste horário — ajuste manualmente.";
              }
            } else if (!rooms.length) {
              conflictStatus = "MANUAL_REQUIRED";
              conflictNote = conflictNote || "Nenhuma sala cadastrada na clínica.";
            }
          }

          sessionsList.push({
            id: `sess-${sessionCounter++}-${dateIso}`,
            date: dateIso,
            dayOfWeek: dayName,
            disciplineLabel: discLabel,
            therapistId,
            roomId,
            therapistName,
            roomName,
            shift: assignedShift,
            timeSlot: assignedTimeSlot,
            conflictStatus,
            conflictNote,
          });
        }
      });

      curr.setDate(curr.getDate() + 1);
    }

    setGeneratedSessions(sessionsList);
  }

  function addSuggestedGoal(s: SuggestedGoal) {
    setAddedSuggestionKeys((prev) => [...prev, s.key]);
    setSelectedDisciplines((prev) => (s.discipline in prev ? prev : { ...prev, [s.discipline]: "1" }));
    const filled: Goal = {
      key: crypto.randomUUID(),
      discipline: s.discipline,
      domain: s.domain,
      description: s.description,
      baseline: s.baseline,
      target: "",
      criterion: "",
      horizon: "",
      strategy: "",
      methodology: "",
      // Meta de ABA vinda de avaliação: cada item ainda não adquirido já
      // nasce como um programa de coleta por tentativa, pronto pra reunião
      // técnica só ajustar critério de mastery — sem isso a coleta de dados
      // do terapeuta (evolução) nunca teria o que mostrar.
      programs:
        s.discipline === "aba"
          ? s.pendingItems.map((item) => ({
              key: crypto.randomUUID(),
              name: item.description,
              targetType: "tentativa" as const,
              masteryCriterion: "80% de acertos em 3 sessões consecutivas",
              protocolItemId: item.protocolItemId,
              itemCode: item.itemCode,
            }))
          : [],
    };
    setGoals((prev) => {
      const isFirstEmpty =
        prev.length === 1 && !prev[0].discipline && !prev[0].domain && !prev[0].description;
      return isFirstEmpty ? [filled] : [...prev, filled];
    });
  }

  function toggleDiscipline(value: string, checked: boolean) {
    setSelectedDisciplines((prev) => {
      const next = { ...prev };
      if (checked) {
        next[value] = next[value] ?? "1";
      } else {
        delete next[value];
      }
      return next;
    });
  }

  function updateSessoes(value: string, sessoesSemana: string) {
    setSelectedDisciplines((prev) => ({ ...prev, [value]: sessoesSemana }));
  }

  function updateGoal(key: string, field: keyof Omit<Goal, "key">, value: string) {
    setGoals((prev) => prev.map((g) => (g.key === key ? { ...g, [field]: value } : g)));
  }

  function updateGoalFields(key: string, updates: Partial<Omit<Goal, "key">>) {
    setGoals((prev) => prev.map((g) => (g.key === key ? { ...g, ...updates } : g)));
  }


  function removeGoal(key: string) {
    setGoals((prev) => (prev.length === 1 ? prev : prev.filter((g) => g.key !== key)));
  }

  function addProgram(goalKey: string) {
    setGoals((prev) =>
      prev.map((g) => (g.key === goalKey ? { ...g, programs: [...g.programs, emptyProgram()] } : g)),
    );
  }

  function updateProgram(
    goalKey: string,
    programKey: string,
    field: "name" | "targetType" | "masteryCriterion",
    value: string,
  ) {
    setGoals((prev) =>
      prev.map((g) =>
        g.key !== goalKey
          ? g
          : { ...g, programs: g.programs.map((p) => (p.key === programKey ? { ...p, [field]: value } : p)) },
      ),
    );
  }

  function removeProgram(goalKey: string, programKey: string) {
    setGoals((prev) =>
      prev.map((g) => (g.key === goalKey ? { ...g, programs: g.programs.filter((p) => p.key !== programKey) } : g)),
    );
  }

  function handleSubmit() {
    setError(null);

    if (!patientId) {
      setError("Selecione um paciente.");
      return;
    }

    if (gridRows.length === 0) {
      setError("Adicione ao menos uma sessão na grade semanal.");
      return;
    }

    for (const row of gridRows) {
      if (row.daysOfWeek.length === 0) {
        const discLabel = DISCIPLINES.find((d) => d.value === row.discipline)?.label || row.discipline;
        setError(`Selecione ao menos um dia da semana para a sessão de ${discLabel}.`);
        return;
      }
    }

    if (manualSessionsCount > 0 && !acknowledgeManualSessions) {
      setError(
        `${manualSessionsCount} sessão(ões) do calendário conciliado ficaram sem terapeuta, sala ou horário livre e vão exigir ajuste manual na agenda depois de salvar. Marque a confirmação abaixo para salvar mesmo assim, ou ajuste a grade/regenere o calendário.`,
      );
      return;
    }

    const filledGoals = goals.filter((g) => g.discipline || g.domain || g.description);
    if (filledGoals.length === 0) {
      setError("Adicione ao menos uma meta.");
      return;
    }
    const incomplete = filledGoals.find((g) => !g.discipline || !g.domain.trim() || !g.description.trim());
    if (incomplete) {
      setError("Toda meta precisa de disciplina, domínio e descrição.");
      return;
    }

    // Gerar mix de disciplinas a partir da grade
    const disciplineMix: Record<string, { sessoesSemana: number; dias: DayOfWeek[]; turno: string; terapeuta?: string }> = {};
    gridRows.forEach((r) => {
      disciplineMix[r.discipline] = {
        sessoesSemana: r.sessionsPerWeek,
        dias: r.daysOfWeek,
        turno: r.shift,
        terapeuta: therapists.find((t) => t.id === r.therapistId)?.full_name,
      };
    });

    const formData = new FormData();
    formData.set("review_due_at", reviewDueAt);
    formData.set("general_objective", generalObjective);
    formData.set("family_priorities", familyPriorities);
    formData.set("pts_grid_rows", JSON.stringify(gridRows));
    formData.set("pts_generated_sessions", JSON.stringify(generatedSessions));
    formData.set("pts_start_date", startDateStr);
    formData.set("pts_valid_until", validUntilStr);
    formData.set("discipline_mix", JSON.stringify(disciplineMix));
    formData.set(
      "goals",
      JSON.stringify(
        filledGoals.map((g) => ({
          discipline: g.discipline,
          domain: g.domain,
          description: g.description,
          baseline: g.baseline,
          target: g.target,
          criterion: g.criterion,
          horizon: g.horizon,
          strategy: g.strategy,
          methodology: g.methodology,
          programs: g.programs
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              targetType: p.targetType,
              masteryCriterion: p.masteryCriterion.trim() || null,
              protocolItemId: p.protocolItemId,
            })),
        })),
      ),
    );

    startTransition(async () => {
      const result = await createTreatmentPlan(patientId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/supervisao");
    });
  }

  return (
    <div className="space-y-6">
      {/* SEÇÃO SUPERIOR: Grid 2 colunas equilibradas no Desktop (6 colunas / 6 colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* COLUNA ESQUERDA (Informações Principais & Equipe) */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="rounded-lg border border-paper-line-strong bg-white p-5 shadow-sm space-y-4 flex-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2 border-b border-paper-line pb-2.5 m-0">
              <span>👤</span> Informações Principais do Plano
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft" htmlFor={`${formId}-patient`}>
                  Paciente *
                </label>
                <select
                  id={`${formId}-patient`}
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
                {patients.length === 0 && (
                  <p className="mt-1 text-xs text-ink-faint">Nenhum paciente ativo ou em avaliação nesta clínica.</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft" htmlFor={`${formId}-review`}>
                  Data de Revisão
                </label>
                <input
                  id={`${formId}-review`}
                  type="date"
                  value={reviewDueAt}
                  onChange={(e) => setReviewDueAt(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft" htmlFor={`${formId}-objective`}>
                Objetivo geral do plano
              </label>
              <textarea
                id={`${formId}-objective`}
                value={generalObjective}
                onChange={(e) => setGeneralObjective(e.target.value)}
                rows={2}
                placeholder="Descreva o propósito geral da intervenção terapêutica…"
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft" htmlFor={`${formId}-priorities`}>
                Prioridades relatadas pela família (1ª avaliação / anamnese)
              </label>
              <textarea
                id={`${formId}-priorities`}
                value={familyPriorities}
                onChange={(e) => setFamilyPriorities(e.target.value)}
                rows={2}
                placeholder="Principais queixas ou prioridades pontuadas pela família…"
                className={inputClass}
              />
            </div>
          </div>

          {teamSuggestions.length > 0 && (
            <div className="rounded-lg border border-paper-line-strong bg-paper/60 p-4 shadow-sm space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-ink flex items-center gap-2">
                <span>👥</span> Equipe de avaliação já definida
              </div>
              <p className="text-xs text-ink-faint m-0">Disciplinas abaixo já vêm marcadas conforme a equipe avaliadora.</p>
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink">
                {teamSuggestions.map((t, i) => (
                  <li key={i} className="bg-white border border-paper-line rounded-md p-2 flex flex-col">
                    <span className="font-semibold text-ink">{t.profileName}</span>
                    <span className="text-ink-faint">{t.roleLabel} {t.discipline && `• ${DISCIPLINES.find((d) => d.value === t.discipline)?.label ?? t.discipline}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA (Sugestões da Avaliação expandidas) */}
        <div className="lg:col-span-6 flex flex-col">
          {suggestedGoals.length > 0 ? (
            <div className="rounded-lg border border-paper-line-strong bg-white p-5 shadow-sm space-y-3 flex-1 flex flex-col">
              <div className="text-xs font-bold uppercase tracking-wide text-ink flex items-center gap-2 border-b border-paper-line pb-2">
                <span>💡</span> Sugestões de metas (da Avaliação do Paciente)
              </div>
              <p className="text-xs text-ink-faint m-0">
                Itens pendentes dos protocolos aplicados na avaliação. Adicione diretamente às metas SMART.
              </p>
              <ul className="flex flex-col gap-2.5 overflow-y-auto max-h-[360px] pr-1 flex-1">
                {suggestedGoals.map((s) => {
                  const added = addedSuggestionKeys.includes(s.key);
                  return (
                    <li key={s.key} className="flex items-center justify-between gap-3 rounded-md border border-paper-line-strong bg-paper/50 p-3 hover:bg-paper transition-all">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-ink">
                          {s.domain} <span className="font-normal text-ink-faint">· {s.protocolLabel}</span>
                        </div>
                        <div className="text-xs text-ink-soft line-clamp-2">{s.description}</div>
                        {s.baseline && <div className="text-[11px] text-ink-faint italic">{s.baseline}</div>}
                      </div>
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => addSuggestedGoal(s)}
                        className="shrink-0 rounded-md border border-paper-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-chart hover:border-chart hover:bg-chart-soft/30 disabled:opacity-40 transition-all shadow-sm"
                      >
                        {added ? "✓ Adicionada" : "+ Adicionar"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-paper-line-strong bg-paper/30 p-5 shadow-sm space-y-2 flex-1 flex flex-col items-center justify-center text-center">
              <span className="text-2xl">📋</span>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-soft">Pronto para Planejamento</div>
              <p className="text-xs text-ink-faint max-w-xs m-0">
                Preencha a grade semanal e adicione as metas SMART abaixo para concluir a elaboração do PTS.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* GRADE SEMANAL DE ATENDIMENTO E CONCILIAÇÃO DE CALENDÁRIO DO PTS */}
      <div className="rounded-lg border border-paper-line-strong bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-paper-line">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2 m-0">
              <span className="text-base">📋</span> Grade de Sessões Semanais do PTS
            </h2>
            <p className="text-xs text-ink-soft mt-0.5 m-0">
              Configure a especialidade, quantidade de sessões, dias disponíveis (Seg-Sáb), turno e terapeuta direcionado.
            </p>
          </div>
          <button
            type="button"
            onClick={addGridRow}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-chart bg-chart-soft hover:bg-chart-soft/80 rounded-md border border-chart/30 transition-all"
          >
            <span>+</span> Adicionar Mais uma Sessão
          </button>
        </div>

        {/* Lista de Linhas da Grade (Cada Linha uma Sessão/Especialidade) */}
        <div className="space-y-3">
          {gridRows.map((row, index) => (
            <div
              key={row.id}
              className="p-4 rounded-md border border-paper-line-strong bg-paper/60 space-y-3 relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  Sessão / Especialidade #{index + 1}
                </span>
                {gridRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGridRow(row.id)}
                    className="text-xs text-status-negative-text hover:underline font-medium"
                  >
                    Remover Linha
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Especialidade / Terapia */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">
                    Especialidade / Terapia
                  </label>
                  <select
                    value={row.discipline}
                    onChange={(e) => updateGridRow(row.id, "discipline", e.target.value)}
                    className="w-full rounded-md border border-paper-line-strong bg-white px-2.5 py-1.5 text-xs text-ink focus:border-chart focus:outline-none"
                  >
                    {DISCIPLINES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Número de Sessões Semanal */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">
                    Sessões / Semana
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={row.sessionsPerWeek}
                    onChange={(e) => updateGridRow(row.id, "sessionsPerWeek", Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full rounded-md border border-paper-line-strong bg-white px-2.5 py-1.5 text-xs text-ink focus:border-chart focus:outline-none"
                  />
                </div>

                {/* 3. Turno e Período de 40min */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">
                    Turno Disponível
                  </label>
                  <select
                    value={row.shift}
                    onChange={(e) => updateGridRow(row.id, "shift", e.target.value as "MANHA" | "TARDE" | "NOITE")}
                    className="w-full rounded-md border border-paper-line-strong bg-white px-2.5 py-1.5 text-xs text-ink focus:border-chart focus:outline-none"
                  >
                    <option value="MANHA">Manhã (08:00 - 12:00 • 40min)</option>
                    <option value="TARDE">Tarde (13:00 - 17:00 • 40min)</option>
                    <option value="NOITE">Noite (17:00 - 21:00 • 40min)</option>
                  </select>
                </div>

                {/* 4. Terapeuta Direcionado (Opcional) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1">
                    Terapeuta Direcionado (Opcional)
                  </label>
                  <select
                    value={row.therapistId}
                    onChange={(e) => updateGridRow(row.id, "therapistId", e.target.value)}
                    className="w-full rounded-md border border-paper-line-strong bg-white px-2.5 py-1.5 text-xs text-ink focus:border-chart focus:outline-none"
                  >
                    <option value="">Sem direcionamento (requer ajuste manual depois)</option>
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Dias da Semana (Segunda a Sábado) */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-ink-soft mb-1.5">
                  Disponibilidade de Dias da Semana (Segunda a Sábado)
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(Object.keys(DAY_LABELS) as DayOfWeek[]).map((day) => {
                    const selected = row.daysOfWeek.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDayOfWeek(row.id, day)}
                        className={`inline-flex items-center justify-center gap-1 min-w-[54px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          selected
                            ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/30"
                            : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:border-slate-400 hover:text-slate-900"
                        }`}
                      >
                        {selected && <span className="text-[10px] font-black leading-none">✓</span>}
                        {DAY_LABELS[day]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Período Atinente à Duração de Sessão de 40 minutos */}
              <div className="mt-2.5 pt-2.5 border-t border-paper-line">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1">
                    <span>⏱️</span> Horários Fatiados em Sessões de 40 Minutos ({row.shift === "MANHA" ? "Manhã" : row.shift === "TARDE" ? "Tarde" : "Noite"})
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                    Duração da Sessão: 40 minutos
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {generate40MinSlotsForShift(row.shift).map((slotStr) => {
                    const isSelected = row.preferredSlot === slotStr;
                    return (
                      <button
                        key={slotStr}
                        type="button"
                        onClick={() => updateGridRow(row.id, "preferredSlot", isSelected ? undefined : slotStr)}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-all ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold ring-2 ring-indigo-600/30"
                            : "bg-white text-ink-soft border-paper-line-strong hover:bg-paper hover:text-ink"
                        }`}
                        title={isSelected ? "Slot de 40min preferencial selecionado" : "Clique para fixar este slot de 40min como preferencial"}
                      >
                        {isSelected ? "★ " : ""}{slotStr}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Data de Início e Ação de Gerar Calendário de 6 Meses */}
        <div className="pt-3 border-t border-paper-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-ink-soft whitespace-nowrap">
              Início do Atendimento:
            </label>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="rounded-md border border-paper-line-strong bg-white px-3 py-1.5 text-xs text-ink focus:border-chart focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateCalendar}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-status-positive hover:opacity-90 rounded-md shadow-sm transition-all"
          >
            <span className="text-sm">🗓️</span> Criar Calendário de Sessões (Mensal - 6 Meses)
          </button>
        </div>
      </div>

      {/* VISUALIZAÇÃO DO CALENDÁRIO CONCILIADO DOS 6 MESES INSERIDO NO PTS */}
      {generatedSessions.length > 0 && (
        <PTSCalendarView
          sessions={generatedSessions}
          therapists={therapists}
          rooms={rooms}
          startDate={startDateStr}
          validUntil={validUntilStr}
          onOpenPrintModal={() => setShowPrintModal(true)}
          onUpdateSession={handleUpdateSession}
        />
      )}

      {/* MODAL DE IMPRESSÃO TIMBRADA */}
      {showPrintModal && (
        <PTSPrintableCalendar
          patientName={patients.find((p) => p.id === patientId)?.full_name || "Paciente Selecionado"}
          startDate={startDateStr}
          validUntil={validUntilStr}
          sessions={generatedSessions}
          clinic={clinic}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* TOAST FEEDBACK PARA OPERAÇÕES DE TEMPLATE */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 rounded-lg border border-chart/30 bg-chart/90 text-white px-4 py-3 shadow-xl backdrop-blur-md text-xs font-semibold animate-in slide-in-from-top duration-300">
          {toastMessage}
        </div>
      )}

      {/* DATALISTS DE AUTOCOMPLETE (Domínio, Linha de Base, Estratégia) */}
      <datalist id="pts-domains-list">
        {autocompleteOptions.domains.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      <datalist id="pts-baselines-list">
        {autocompleteOptions.baselines.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      <datalist id="pts-strategies-list">
        {autocompleteOptions.strategies.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* METAS SMART (Layout Grid Responsivo de 2 colunas no Desktop grande) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-paper-line pb-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2 m-0">
              <span>🎯</span> Metas SMART e Programas ABA
            </h2>
            <p className="text-xs text-ink-soft mt-0.5 m-0">
              Defina os objetivos específicos, critérios de domínio, estratégias e programas para coleta.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGoals((prev) => [...prev, emptyGoal()])}
            className="rounded-md border border-paper-line-strong bg-white px-3.5 py-1.5 text-xs font-bold text-chart hover:border-chart hover:bg-chart-soft/30 transition-all shadow-sm"
          >
            + Adicionar meta
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {goals.map((goal, index) => (
            <div key={goal.key} className="rounded-lg border border-paper-line-strong bg-white p-5 shadow-sm space-y-4 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-paper-line pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                  Meta #{index + 1}
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveModalGoalKey(goal.key)}
                    className="inline-flex items-center gap-1 rounded-md border border-chart/30 bg-chart-soft/40 px-2.5 py-1 text-[11px] font-bold text-chart hover:bg-chart-soft transition-all"
                  >
                    <span>💡</span> Usar Template
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveGoalAsTemplate(goal)}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-all"
                    title="Salvar esta meta no banco de templates da clínica"
                  >
                    <span>⭐</span> Salvar no Banco
                  </button>

                  <button
                    type="button"
                    onClick={() => removeGoal(goal.key)}
                    disabled={goals.length === 1}
                    className="text-xs text-status-negative-text hover:underline font-semibold disabled:opacity-40 ml-1"
                  >
                    Remover
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Disciplina *</label>
                  <select
                    value={goal.discipline}
                    onChange={(e) => updateGoal(goal.key, "discipline", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione…</option>
                    {DISCIPLINES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <GoalForm
                    goal={goal}
                    onChange={(updatedFields) => updateGoalFields(goal.key, updatedFields)}
                    inputClass={inputClass}
                    allowCreate={true}
                  />
                </div>


                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Linha de base (opcional)</label>
                  <input
                    list="pts-baselines-list"
                    value={goal.baseline}
                    onChange={(e) => updateGoal(goal.key, "baseline", e.target.value)}
                    placeholder="Busque ou digite a linha de base…"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Alvo (opcional)</label>
                  <input
                    value={goal.target}
                    onChange={(e) => updateGoal(goal.key, "target", e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Critério de mastery (opcional)</label>
                  <input
                    value={goal.criterion}
                    onChange={(e) => updateGoal(goal.key, "criterion", e.target.value)}
                    placeholder="Ex: 80% de precisão em 3 sessões consecutivas"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Horizonte</label>
                  <select
                    value={goal.horizon}
                    onChange={(e) => updateGoal(goal.key, "horizon", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione…</option>
                    <option value="curto">Curto prazo</option>
                    <option value="medio">Médio prazo</option>
                    <option value="longo">Longo prazo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Metodologia</label>
                  <select
                    value={goal.methodology}
                    onChange={(e) => updateGoal(goal.key, "methodology", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione…</option>
                    <option value="dtt">DTT (ensino estruturado)</option>
                    <option value="naturalistico">Ensino naturalístico</option>
                    <option value="misto">Misto</option>
                    <option value="outra">Outra</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Estratégia (o que exatamente será feito)
                  </label>
                  <textarea
                    value={goal.strategy}
                    onChange={(e) => updateGoal(goal.key, "strategy", e.target.value)}
                    rows={2}
                    placeholder="Procedimento detalhado para aplicação…"
                    className={inputClass}
                  />
                </div>
              </div>

              {goal.discipline === "aba" && (
                <div className="mt-4 border-t border-paper-line-strong pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                        Programas ABA (coleta por tentativa)
                      </h3>
                      <p className="text-[11px] text-ink-faint m-0">
                        Alvos de coleta registrados tentativa a tentativa pelo terapeuta.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProgram(goal.key)}
                      className="shrink-0 rounded-md border border-paper-line-strong bg-white px-2.5 py-1 text-xs font-semibold text-chart hover:border-chart transition-all"
                    >
                      + Programa
                    </button>
                  </div>

                  {goal.programs.length === 0 && (
                    <p className="text-xs text-ink-faint italic m-0">Nenhum programa cadastrado para esta meta.</p>
                  )}

                  <div className="space-y-2">
                    {goal.programs.map((program) => (
                      <div
                        key={program.key}
                        className="grid grid-cols-1 items-start gap-2 rounded-md border border-paper-line-strong bg-paper/60 p-2.5 sm:grid-cols-[1fr_140px_1fr_auto]"
                      >
                        <div>
                          <label className="text-[10px] font-bold uppercase text-ink-faint">Nome do programa</label>
                          <input
                            value={program.name}
                            disabled={!!program.protocolItemId}
                            onChange={(e) => updateProgram(goal.key, program.key, "name", e.target.value)}
                            placeholder="Ex: aponta objetos…"
                            className={`${inputClass} disabled:opacity-70`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-ink-faint">Tipo registro</label>
                          <select
                            value={program.targetType}
                            onChange={(e) =>
                              updateProgram(goal.key, program.key, "targetType", e.target.value)
                            }
                            className={inputClass}
                          >
                            {(Object.keys(TARGET_TYPE_LABEL) as ProgramTargetType[]).map((t) => (
                              <option key={t} value={t}>
                                {TARGET_TYPE_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-ink-faint">Critério mastery</label>
                          <input
                            value={program.masteryCriterion}
                            onChange={(e) =>
                              updateProgram(goal.key, program.key, "masteryCriterion", e.target.value)
                            }
                            placeholder="Ex: 80% em 3 sessões"
                            className={inputClass}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProgram(goal.key, program.key)}
                          className="self-end text-xs text-status-negative-text font-semibold hover:underline sm:mb-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL SELETOR DE TEMPLATES */}
      {activeModalGoalKey && (
        <PtsTemplateModal
          isOpen={!!activeModalGoalKey}
          onClose={() => setActiveModalGoalKey(null)}
          initialDiscipline={goals.find((g) => g.key === activeModalGoalKey)?.discipline || ""}
          onSelectTemplate={(template) => applyTemplateToGoal(activeModalGoalKey, template)}
        />
      )}

      {/* BARRA DE AÇÃO FIXA / RODAPÉ DO FORMULÁRIO */}
      <div className="sticky bottom-4 z-20 rounded-xl border border-paper-line-strong bg-white/95 backdrop-blur-md p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          {error ? (
            <p className="text-xs font-semibold text-status-negative-text flex items-center gap-1.5 m-0">
              <span>⚠️</span> {error}
            </p>
          ) : (
            <p className="text-xs text-ink-soft m-0">
              Revise a grade de atendimento e as metas SMART antes de salvar o PTS.
            </p>
          )}
          {manualSessionsCount > 0 && (
            <label className="mt-2 flex items-start gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={acknowledgeManualSessions}
                onChange={(e) => setAcknowledgeManualSessions(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Estou ciente de que <strong>{manualSessionsCount} sessão(ões)</strong> do calendário conciliado não têm
                terapeuta, sala ou horário livre e vou ajustá-las manualmente na agenda depois de salvar.
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => router.push("/supervisao")}
            className="px-4 py-2 text-xs font-semibold text-ink-soft bg-paper hover:bg-paper-line-strong rounded-md border border-paper-line transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 px-6 py-2 text-xs font-bold text-white bg-chart hover:opacity-90 rounded-md shadow-md transition-all disabled:opacity-50"
          >
            {isPending ? "Salvando PTS…" : "💾 Salvar Plano em Rascunho"}
          </button>
        </div>
      </div>
    </div>
  );
}
