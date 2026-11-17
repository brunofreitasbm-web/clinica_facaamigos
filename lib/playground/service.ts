import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { nextCalendarDay, todayInTimeZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { getProtocolScale } from "@/lib/protocol-assessments";
import { ageLabel, buildDisplayNames } from "./display.ts";
import { buildSnapshotScores, latestItemEntries } from "./snapshot.ts";
import { computeVisitStatus, isConclusionPending, type PlaygroundVisitStatus } from "./status.ts";
import { isSavedAtPlausible, isSavedOnVisitDay } from "./window.ts";

type Admin = SupabaseClient<Database>;

export type ServiceFail = { ok: false; status: number; code: string; error: string };
export type ServiceOk<T> = { ok: true; data: T };
export type ServiceResult<T> = ServiceOk<T> | ServiceFail;

const fail = (status: number, code: string, error: string): ServiceFail => ({ ok: false, status, code, error });
const ok = <T>(data: T): ServiceOk<T> => ({ ok: true, data });

const MAX_ENTRIES_PER_BATCH = 50;
const MAX_EVOLUTION_LENGTH = 4000;
const VBMAPP_NAME = "vbmapp";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function levelPrefix(level: number): string {
  return `Nível ${level}`;
}

type Author = { employeeId: string; name: string; specialty: string | null };

function parseAuthor(raw: unknown): Author | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const employeeId = asString(a.employeeId);
  const name = asString(a.name);
  if (!employeeId || !name || name.length > 120) return null;
  const specialty = asString(a.specialty);
  return { employeeId, name, specialty: specialty ? specialty.slice(0, 60) : null };
}

async function firstEntryAt(admin: Admin, visitId: string): Promise<string | null> {
  const { data } = await admin
    .from("playground_entries")
    .select("saved_at")
    .eq("visit_id", visitId)
    .order("saved_at", { ascending: true })
    .limit(1);
  return data?.[0]?.saved_at ?? null;
}

type VisitRow = Database["public"]["Tables"]["playground_visits"]["Row"];
type SeriesRow = Database["public"]["Tables"]["playground_series"]["Row"];

async function loadVisitContext(
  admin: Admin,
  visitId: string,
  posUnitId: string,
): Promise<ServiceResult<{ visit: VisitRow; series: SeriesRow }>> {
  if (!visitId) return fail(400, "bad_request", "Visita não informada.");
  const { data: visit } = await admin.from("playground_visits").select("*").eq("id", visitId).maybeSingle();
  if (!visit) return fail(404, "not_found", "Visita não encontrada.");
  const { data: series } = await admin.from("playground_series").select("*").eq("id", visit.series_id).maybeSingle();
  if (!series) return fail(404, "not_found", "Visita não encontrada.");
  const { data: location } = await admin
    .from("playground_locations")
    .select("pos_unit_id")
    .eq("id", series.location_id)
    .maybeSingle();
  if (!location || (posUnitId && location.pos_unit_id !== posUnitId)) {
    return fail(404, "not_found", "Visita não encontrada.");
  }
  return ok({ visit, series });
}

async function statusFor(admin: Admin, visit: VisitRow, now: Date): Promise<PlaygroundVisitStatus> {
  return computeVisitStatus(
    {
      scheduledStart: visit.scheduled_start,
      durationMin: visit.duration_min,
      arrivedAt: visit.arrived_at,
      leftAt: visit.left_at,
      cancelledAt: visit.cancelled_at,
      firstEntryAt: await firstEntryAt(admin, visit.id),
    },
    now,
    CLINIC_TIMEZONE,
  );
}

// ---------------------------------------------------------------- today

export async function getTodayPayload(admin: Admin, body: Record<string, unknown>, now: Date) {
  const posUnitId = asString(body.posUnitId);
  if (!posUnitId) return fail(400, "bad_request", "Unidade não informada.");

  const empty = {
    serverNow: now.toISOString(),
    protocolConfigured: false,
    scale: null as null | { min: number; max: number; labels: Record<number, string> },
    visits: [] as unknown[],
    catalogs: {} as Record<string, unknown>,
    state: {} as Record<string, unknown>,
    pendingConclusions: [] as unknown[],
  };

  const { data: location } = await admin
    .from("playground_locations")
    .select("id, clinic_id")
    .eq("pos_unit_id", posUnitId)
    .eq("active", true)
    .maybeSingle();
  if (!location) return ok(empty);

  const { data: protocol } = await admin
    .from("protocols")
    .select("id, scale")
    .eq("clinic_id", location.clinic_id)
    .eq("name", VBMAPP_NAME)
    .maybeSingle();
  if (!protocol) return ok(empty);
  const scale = getProtocolScale(protocol.scale);

  const { data: seriesList } = await admin
    .from("playground_series")
    .select("*")
    .eq("location_id", location.id)
    .eq("status", "liberada");
  const series = seriesList ?? [];
  if (series.length === 0) return ok({ ...empty, protocolConfigured: true, scale });
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const seriesIds = series.map((s) => s.id);

  const today = todayInTimeZone(CLINIC_TIMEZONE);
  const dayStart = zonedDateTimeToUtc(today, "00:00", CLINIC_TIMEZONE).toISOString();
  const dayEnd = zonedDateTimeToUtc(nextCalendarDay(today), "00:00", CLINIC_TIMEZONE).toISOString();

  const { data: allVisits } = await admin
    .from("playground_visits")
    .select("*")
    .in("series_id", seriesIds)
    .is("cancelled_at", null);
  const visitsAll = allVisits ?? [];
  const todaysVisits = visitsAll
    .filter((v) => v.scheduled_start >= dayStart && v.scheduled_start < dayEnd)
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

  const patientIds = [...new Set(series.map((s) => s.patient_id))];
  const { data: patients } = await admin.from("patients").select("id, full_name, birth_date").in("id", patientIds);
  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));

  const { data: entriesRaw } = await admin
    .from("playground_entries")
    .select("*")
    .in("series_id", seriesIds)
    .order("saved_at", { ascending: true });
  const entries = entriesRaw ?? [];

  const visitNoById = new Map(visitsAll.map((v) => [v.id, v.visit_no]));

  // Catálogo só dos níveis usados hoje.
  const levels = [...new Set(todaysVisits.map((v) => seriesById.get(v.series_id)?.level).filter((l): l is number => !!l))];
  const catalogs: Record<string, unknown> = {};
  await Promise.all(
    levels.map(async (level) => {
      const { data: items } = await admin
        .from("protocol_items")
        .select("id, domain, item_code, description, sort_order")
        .eq("protocol_id", protocol.id)
        .like("level", `${levelPrefix(level)}%`)
        .order("sort_order", { ascending: true });
      const domains: { domain: string; label: string; items: { id: string; code: string; description: string }[] }[] = [];
      for (const item of items ?? []) {
        let group = domains.find((d) => d.domain === item.domain);
        if (!group) {
          group = { domain: item.domain, label: item.domain, items: [] };
          domains.push(group);
        }
        group.items.push({ id: item.id, code: item.item_code, description: item.description });
      }
      catalogs[String(level)] = domains;
    }),
  );

  const displayNames = buildDisplayNames(
    todaysVisits.flatMap((v) => {
      const s = seriesById.get(v.series_id);
      const p = s ? patientById.get(s.patient_id) : undefined;
      return p ? [{ id: v.id, fullName: p.full_name, scheduledStart: v.scheduled_start }] : [];
    }),
  );

  const visits = todaysVisits.map((v) => {
    const s = seriesById.get(v.series_id)!;
    const p = patientById.get(s.patient_id);
    const visitEntries = entries.filter((e) => e.visit_id === v.id);
    const firstEntry = visitEntries[0]?.saved_at ?? null;
    return {
      visitId: v.id,
      seriesId: v.series_id,
      visitNo: v.visit_no,
      totalVisits: s.total_visits,
      scheduledStart: v.scheduled_start,
      durationMin: v.duration_min,
      displayName: displayNames.get(v.id) ?? "Criança",
      ageLabel: p?.birth_date ? ageLabel(p.birth_date, today) : "",
      level: s.level,
      status: computeVisitStatus(
        {
          scheduledStart: v.scheduled_start,
          durationMin: v.duration_min,
          arrivedAt: v.arrived_at,
          leftAt: v.left_at,
          cancelledAt: v.cancelled_at,
          firstEntryAt: firstEntry,
        },
        now,
        CLINIC_TIMEZONE,
      ),
      arrivedAt: v.arrived_at,
      leftAt: v.left_at,
      entryCount: visitEntries.length,
      authorCount: new Set(visitEntries.map((e) => e.author_pos_employee_id)).size,
      conclusionPending: false,
    };
  });

  // Estado atual (último valor por item, com autor) e evoluções, por série de hoje.
  const state: Record<string, unknown> = {};
  for (const seriesId of new Set(todaysVisits.map((v) => v.series_id))) {
    const own = entries.filter((e) => e.series_id === seriesId);
    const latest = latestItemEntries(
      own.map((e) => ({
        kind: e.kind as "item" | "evolution",
        protocolItemId: e.protocol_item_id,
        score: e.score,
        savedAt: e.saved_at,
        entry: e,
      })),
    );
    state[seriesId] = {
      items: [...latest.values()]
        .filter((l) => l.score !== null)
        .map((l) => ({
          itemId: l.protocolItemId,
          score: l.score,
          authorName: l.entry.author_name_snapshot,
          authorSpecialty: l.entry.author_specialty_snapshot,
          visitNo: visitNoById.get(l.entry.visit_id) ?? null,
          savedAt: l.entry.saved_at,
        })),
      evolutions: own
        .filter((e) => e.kind === "evolution")
        .map((e) => ({ visitId: e.visit_id, text: e.text, authorName: e.author_name_snapshot, savedAt: e.saved_at })),
    };
  }

  // Séries com a última visita agendada já passada e sem conclusão.
  const pendingConclusions = series
    .filter((s) =>
      isConclusionPending(
        {
          status: s.status as "liberada",
          activeVisitStarts: visitsAll.filter((v) => v.series_id === s.id).map((v) => v.scheduled_start),
        },
        now,
        CLINIC_TIMEZONE,
      ),
    )
    .map((s) => {
      const p = patientById.get(s.patient_id);
      const names = buildDisplayNames(p ? [{ id: s.id, fullName: p.full_name, scheduledStart: "" }] : []);
      const lastStart = visitsAll
        .filter((v) => v.series_id === s.id)
        .map((v) => v.scheduled_start)
        .sort()
        .at(-1);
      return {
        seriesId: s.id,
        displayName: names.get(s.id) ?? "Criança",
        ageLabel: p?.birth_date ? ageLabel(p.birth_date, today) : "",
        lastVisitStart: lastStart ?? null,
      };
    });

  return ok({
    serverNow: now.toISOString(),
    protocolConfigured: true,
    scale,
    visits,
    catalogs,
    state,
    pendingConclusions,
  });
}

// ---------------------------------------------------------------- visit

export async function recordVisitAction(admin: Admin, body: Record<string, unknown>, now: Date) {
  const action = asString(body.action);
  if (action !== "arrive" && action !== "leave") return fail(400, "bad_request", "Ação inválida.");
  const employeeId = asString(body.employeeId);
  if (!employeeId) return fail(400, "bad_request", "Colaborador não informado.");
  const at = asString(body.at);
  if (!at || !isSavedAtPlausible(at, now)) return fail(400, "bad_request", "Horário inválido.");

  const ctx = await loadVisitContext(admin, asString(body.visitId), asString(body.posUnitId));
  if (!ctx.ok) return ctx;
  const { visit, series } = ctx.data;
  if (series.status !== "liberada" || visit.cancelled_at) {
    return fail(409, "series_closed", "Esta visita não está mais disponível.");
  }
  if (!isSavedOnVisitDay(at, visit.scheduled_start, CLINIC_TIMEZONE)) {
    return fail(409, "day_closed", "O dia desta visita já terminou.");
  }

  if (action === "arrive") {
    await admin
      .from("playground_visits")
      .update({ arrived_at: at, arrived_by_pos_employee_id: employeeId })
      .eq("id", visit.id)
      .is("arrived_at", null);
  } else {
    // Saída sem chegada registrada: carimba a chegada junto, para não travar o fluxo.
    if (!visit.arrived_at) {
      await admin
        .from("playground_visits")
        .update({ arrived_at: at, arrived_by_pos_employee_id: employeeId })
        .eq("id", visit.id)
        .is("arrived_at", null);
    }
    await admin
      .from("playground_visits")
      .update({ left_at: at, left_by_pos_employee_id: employeeId })
      .eq("id", visit.id)
      .is("left_at", null);
  }

  const { data: fresh } = await admin.from("playground_visits").select("*").eq("id", visit.id).single();
  const current = fresh ?? visit;
  return ok({
    status: await statusFor(admin, current, now),
    arrivedAt: current.arrived_at,
    leftAt: current.left_at,
  });
}

// ---------------------------------------------------------------- entries

type EntryInput = {
  idempotencyKey: string;
  kind: "item" | "evolution";
  itemId: string | null;
  score: number | null;
  text: string | null;
  savedAt: string;
};

export async function recordEntries(admin: Admin, body: Record<string, unknown>, now: Date) {
  const author = parseAuthor(body.author);
  if (!author) return fail(400, "bad_request", "Autor inválido.");
  const rawEntries = Array.isArray(body.entries) ? body.entries : null;
  if (!rawEntries || rawEntries.length === 0) return fail(400, "bad_request", "Nada para salvar.");
  if (rawEntries.length > MAX_ENTRIES_PER_BATCH) return fail(400, "bad_request", "Lote grande demais.");

  const ctx = await loadVisitContext(admin, asString(body.visitId), asString(body.posUnitId));
  if (!ctx.ok) return ctx;
  const { visit, series } = ctx.data;
  if (series.status !== "liberada" || visit.cancelled_at) {
    return fail(409, "series_closed", "Esta avaliação já foi concluída.");
  }
  if (!visit.arrived_at) return fail(409, "not_arrived", "Marque a chegada da criança antes de avaliar.");

  const { data: protocol } = await admin.from("protocols").select("scale").eq("id", series.protocol_id).maybeSingle();
  const scale = getProtocolScale(protocol?.scale);

  // Itens válidos: só os do nível da série.
  const { data: levelItems } = await admin
    .from("protocol_items")
    .select("id")
    .eq("protocol_id", series.protocol_id)
    .like("level", `${levelPrefix(series.level)}%`);
  const validItemIds = new Set((levelItems ?? []).map((i) => i.id));

  const rejected: { idempotencyKey: string; code: string; error: string }[] = [];
  const valid: EntryInput[] = [];

  for (const raw of rawEntries) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const key = asString(e.idempotencyKey);
    const reject = (code: string, error: string) => rejected.push({ idempotencyKey: key, code, error });
    if (!key || key.length > 200) {
      reject("bad_request", "Entrada sem identificador.");
      continue;
    }
    const savedAt = asString(e.savedAt);
    if (!savedAt || !isSavedAtPlausible(savedAt, now)) {
      reject("bad_request", "Horário inválido.");
      continue;
    }
    if (!isSavedOnVisitDay(savedAt, visit.scheduled_start, CLINIC_TIMEZONE)) {
      reject("day_closed", "O dia desta visita já terminou.");
      continue;
    }
    if (e.kind === "item") {
      const itemId = asString(e.itemId);
      if (!validItemIds.has(itemId)) {
        reject("bad_request", "Item fora do nível desta avaliação.");
        continue;
      }
      let score: number | null = null;
      if (e.score !== null && e.score !== undefined) {
        const n = Number(e.score);
        if (!Number.isInteger(n) || n < scale.min || n > scale.max) {
          reject("bad_request", "Pontuação inválida.");
          continue;
        }
        score = n;
      }
      valid.push({ idempotencyKey: key, kind: "item", itemId, score, text: null, savedAt });
    } else if (e.kind === "evolution") {
      const text = asString(e.text);
      if (!text || text.length > MAX_EVOLUTION_LENGTH) {
        reject("bad_request", "Texto de evolução inválido.");
        continue;
      }
      valid.push({ idempotencyKey: key, kind: "evolution", itemId: null, score: null, text, savedAt });
    } else {
      reject("bad_request", "Tipo de entrada inválido.");
    }
  }

  let duplicates = 0;
  let accepted = 0;
  if (valid.length > 0) {
    const { data: existing } = await admin
      .from("playground_entries")
      .select("idempotency_key")
      .in("idempotency_key", valid.map((v) => v.idempotencyKey));
    const existingKeys = new Set((existing ?? []).map((e) => e.idempotency_key));
    duplicates = valid.filter((v) => existingKeys.has(v.idempotencyKey)).length;
    const fresh = valid.filter((v) => !existingKeys.has(v.idempotencyKey));

    if (fresh.length > 0) {
      const rows = fresh.map((v) => ({
        series_id: series.id,
        visit_id: visit.id,
        kind: v.kind,
        protocol_item_id: v.itemId,
        score: v.score,
        text: v.text,
        author_pos_employee_id: author.employeeId,
        author_name_snapshot: author.name,
        author_specialty_snapshot: author.specialty,
        device_id: asString(body.deviceId) || null,
        saved_at: v.savedAt,
        idempotency_key: v.idempotencyKey,
      }));
      const { error } = await admin.from("playground_entries").insert(rows);
      if (error) {
        if (error.code === "23505") {
          // Corrida com um reenvio da fila: grava uma a uma e conta as repetidas.
          for (const row of rows) {
            const { error: oneError } = await admin.from("playground_entries").insert(row);
            if (!oneError) accepted += 1;
            else if (oneError.code === "23505") duplicates += 1;
            else {
              console.error("[playground] falha ao gravar entrada:", oneError);
              return fail(500, "server_error", "Não foi possível salvar agora.");
            }
          }
        } else {
          console.error("[playground] falha ao gravar entradas:", error);
          return fail(500, "server_error", "Não foi possível salvar agora.");
        }
      } else {
        accepted = rows.length;
      }
    }
  }

  return ok({ accepted, duplicates, rejected });
}

// ---------------------------------------------------------------- conclude

export async function concludeSeries(admin: Admin, body: Record<string, unknown>, now: Date) {
  const author = parseAuthor(body.author);
  if (!author) return fail(400, "bad_request", "Autor inválido.");
  const savedAt = asString(body.savedAt);
  if (!savedAt || !isSavedAtPlausible(savedAt, now)) return fail(400, "bad_request", "Horário inválido.");

  const ctx = await loadVisitContext(admin, asString(body.visitId), asString(body.posUnitId));
  if (!ctx.ok) return ctx;
  const { visit, series } = ctx.data;

  if (series.status === "concluida") return ok({ seriesStatus: "concluida" as const });
  if (series.status !== "liberada" || visit.cancelled_at) {
    return fail(409, "series_closed", "Esta avaliação não pode ser concluída.");
  }
  if (!isSavedOnVisitDay(savedAt, visit.scheduled_start, CLINIC_TIMEZONE)) {
    return fail(409, "day_closed", "O dia desta visita já terminou.");
  }

  const { data: entries } = await admin
    .from("playground_entries")
    .select("kind, protocol_item_id, score, saved_at")
    .eq("series_id", series.id);
  const scores = buildSnapshotScores(
    (entries ?? []).map((e) => ({
      kind: e.kind as "item" | "evolution",
      protocolItemId: e.protocol_item_id,
      score: e.score,
      savedAt: e.saved_at,
    })),
  );
  if (Object.keys(scores).length === 0) {
    return fail(409, "empty", "Preencha ao menos um item antes de concluir a avaliação.");
  }

  const { data: assessment, error: insertError } = await admin
    .from("protocol_assessments")
    .insert({
      patient_id: series.patient_id,
      protocol_id: series.protocol_id,
      assessed_by: null,
      source: "playground",
      playground_series_id: series.id,
      scores,
      assessed_at: savedAt,
    })
    .select("id")
    .single();

  let assessmentId = assessment?.id ?? null;
  if (insertError) {
    if (insertError.code !== "23505") {
      console.error("[playground] falha ao gerar o registro oficial:", insertError);
      return fail(500, "server_error", "Não foi possível concluir agora.");
    }
    // Conclusão repetida (outro tablet ou reenvio): reaproveita o registro já criado.
    const { data: existing } = await admin
      .from("protocol_assessments")
      .select("id")
      .eq("playground_series_id", series.id)
      .maybeSingle();
    assessmentId = existing?.id ?? null;
  }
  if (!assessmentId) return fail(500, "server_error", "Não foi possível concluir agora.");

  await admin
    .from("playground_series")
    .update({
      status: "concluida",
      concluded_at: savedAt,
      concluded_by_name: author.name,
      protocol_assessment_id: assessmentId,
    })
    .eq("id", series.id)
    .eq("status", "liberada");

  // Visitas futuras (ainda sem chegada) deixam de valer.
  await admin
    .from("playground_visits")
    .update({ cancelled_at: now.toISOString() })
    .eq("series_id", series.id)
    .is("cancelled_at", null)
    .is("arrived_at", null)
    .neq("id", visit.id);

  return ok({ seriesStatus: "concluida" as const });
}
