/**
 * Casamento de uma chegada declarada pelo QR (data de nascimento + primeiro
 * nome digitados sem login) contra a agenda de hoje. Função pura — sem
 * Supabase, sem I/O — para poder ser testada isolada dos casos-limite mais
 * perigosos do recurso (gêmeos, duas sessões no dia) antes de qualquer UI.
 *
 * A regra central: data de nascimento é a chave forte (não muda, não tem
 * variação de grafia), o nome é só desempate. Quando a combinação é
 * ambígua (gêmeos com a mesma DN, ou duas sessões elegíveis do mesmo
 * paciente), NÃO escolhemos por conta própria — devolvemos os candidatos
 * para a recepção decidir no clique. Ver F3/F4 no plano de implementação.
 */

export type CheckinCandidateAppointment = {
  appointmentId: string;
  patientId: string;
  patientFullName: string;
  /** ISO (YYYY-MM-DD). */
  birthDate: string;
  /** Instante ISO de início da sessão. */
  startsAt: string;
  status: string;
};

export type CheckinMatchQuality =
  | "exato"
  | "ambiguo"
  | "nome_divergente"
  | "fora_da_janela"
  | "nenhum";

export type CheckinMatchResult = {
  quality: CheckinMatchQuality;
  kind: "agendado" | "sem_agendamento";
  patientId: string | null;
  appointmentId: string | null;
  candidateAppointmentIds: string[];
};

// Janela de elegibilidade temporal (F4/F8 do plano): aceita chegada de até
// 90 min antes do início (comum: van escolar adianta) até 30 min depois
// (mesma tolerância de auto_resolve_appointments antes de marcar falta).
const WINDOW_BEFORE_MINUTES = 90;
const WINDOW_AFTER_MINUTES = 30;

/** Remove acentos e normaliza para comparação — o banco não tem `unaccent`,
 * então a normalização precisa acontecer em JS. Mesmo padrão de
 * app/gestor/cadastros/especialidades/actions.ts (slugify). */
function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** true quando `declaredFirstName` casa por prefixo (>=3 chars) com QUALQUER
 * token do nome completo — cobre "Bia" para "Beatriz", nome do meio usado
 * como preferido, etc. (F14 do plano). */
function nameMatchesAnyToken(fullName: string, declaredFirstName: string): boolean {
  const declared = normalizeName(declaredFirstName);
  if (declared.length < 3) return false;
  const tokens = normalizeName(fullName).split(" ").filter(Boolean);
  return tokens.some((token) => token.startsWith(declared) || declared.startsWith(token));
}

function minutesBetween(a: string, b: string): number {
  return (new Date(a).getTime() - new Date(b).getTime()) / 60_000;
}

function isWithinArrivalWindow(startsAtIso: string, nowIso: string): boolean {
  const diff = minutesBetween(startsAtIso, nowIso); // positivo = sessão no futuro
  return diff <= WINDOW_BEFORE_MINUTES && diff >= -WINDOW_AFTER_MINUTES;
}

/** A sessão de referência do dia para exibir "chegou Xh antes/depois" quando
 * nenhuma está dentro da janela — a mais próxima do agora, cronologicamente. */
function closestByTime(appointments: CheckinCandidateAppointment[], nowIso: string): CheckinCandidateAppointment {
  return appointments.reduce((closest, current) =>
    Math.abs(minutesBetween(current.startsAt, nowIso)) < Math.abs(minutesBetween(closest.startsAt, nowIso))
      ? current
      : closest,
  );
}

/**
 * @param todaysAppointments Todas as sessões de hoje da clínica — inclui
 *   canceladas/faltas de propósito (F6: a família pode não ter sido avisada
 *   do cancelamento; a recepção precisa ver a chegada mesmo assim).
 */
export function matchCheckinRequest(
  todaysAppointments: CheckinCandidateAppointment[],
  declared: { firstName: string; birthDate: string },
  nowIso: string = new Date().toISOString(),
): CheckinMatchResult {
  // 1) Filtra por data de nascimento — a chave forte.
  const byBirthDate = todaysAppointments.filter((a) => a.birthDate === declared.birthDate);

  if (byBirthDate.length === 0) {
    return { quality: "nenhum", kind: "sem_agendamento", patientId: null, appointmentId: null, candidateAppointmentIds: [] };
  }

  const distinctPatientsByBirthDate = uniquePatients(byBirthDate);

  // 2) Desempate por nome dentro de quem bateu a data de nascimento.
  const byName = byBirthDate.filter((a) => nameMatchesAnyToken(a.patientFullName, declared.firstName));
  const distinctPatientsByName = uniquePatients(byName);

  if (distinctPatientsByName.length === 0) {
    // Nome não bateu com ninguém. Se a DN aponta para um único paciente,
    // vincula mesmo assim — provavelmente é apelido/nome social — e deixa a
    // recepção conferir (F14). Se a DN aponta para mais de um (gêmeos), não
    // dá para adivinhar: fica ambíguo (F3).
    if (distinctPatientsByBirthDate.length === 1) {
      return resolveForSinglePatient(byBirthDate, nowIso, "nome_divergente");
    }
    return {
      quality: "ambiguo",
      kind: "agendado",
      patientId: null,
      appointmentId: null,
      candidateAppointmentIds: byBirthDate.map((a) => a.appointmentId),
    };
  }

  if (distinctPatientsByName.length > 1) {
    // DN e nome batem para mais de um paciente — irmãos/homônimos reais.
    // Nunca escolher: a tela pública precisa ficar idêntica para os dois
    // casos, senão vaza a existência de um irmão para quem está digitando.
    return {
      quality: "ambiguo",
      kind: "agendado",
      patientId: null,
      appointmentId: null,
      candidateAppointmentIds: byName.map((a) => a.appointmentId),
    };
  }

  // Exatamente um paciente identificado por DN + nome.
  return resolveForSinglePatient(byName, nowIso, "exato");
}

function uniquePatients(appointments: CheckinCandidateAppointment[]): string[] {
  return Array.from(new Set(appointments.map((a) => a.patientId)));
}

/**
 * Um único paciente já identificado, possivelmente com mais de uma sessão
 * hoje (F4: ABA de manhã, fono à tarde). Escolhe a sessão dentro da janela
 * de chegada; se mais de uma estiver na janela (sessões coladas), fica
 * ambíguo; se nenhuma estiver, vincula à mais próxima e sinaliza
 * 'fora_da_janela' para a recepção ver o aviso "chegou Xh antes/depois".
 */
function resolveForSinglePatient(
  appointmentsOfPatient: CheckinCandidateAppointment[],
  nowIso: string,
  qualityWhenSingle: "exato" | "nome_divergente",
): CheckinMatchResult {
  const patientId = appointmentsOfPatient[0].patientId;
  const withinWindow = appointmentsOfPatient.filter((a) => isWithinArrivalWindow(a.startsAt, nowIso));

  if (withinWindow.length === 1) {
    return {
      quality: qualityWhenSingle,
      kind: "agendado",
      patientId,
      appointmentId: withinWindow[0].appointmentId,
      candidateAppointmentIds: [withinWindow[0].appointmentId],
    };
  }

  if (withinWindow.length > 1) {
    return {
      quality: "ambiguo",
      kind: "agendado",
      patientId,
      appointmentId: null,
      candidateAppointmentIds: withinWindow.map((a) => a.appointmentId),
    };
  }

  // Nenhuma sessão do paciente está na janela agora — vincula à mais
  // próxima no tempo (pode ser passada ou futura) só para a recepção ter
  // contexto ("chegou 2h antes da sessão das 11h"); nunca confirma check-in
  // sozinho, então não há risco de check-in errado aqui.
  const closest = closestByTime(appointmentsOfPatient, nowIso);
  return {
    quality: "fora_da_janela",
    kind: "agendado",
    patientId,
    appointmentId: closest.appointmentId,
    candidateAppointmentIds: [closest.appointmentId],
  };
}
