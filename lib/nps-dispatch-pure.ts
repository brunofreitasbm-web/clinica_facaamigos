import { CLINIC_WEBSITE } from "./clinic-identity.ts";

/**
 * Constrói a mensagem e URL da pesquisa NPS de 1ª Avaliação / Anamnese.
 */
export function buildAnamneseNpsPayload(
  guardianName: string | null | undefined,
  patientName: string | null | undefined,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || CLINIC_WEBSITE
) {
  const guardianFirstName = guardianName?.trim() ? guardianName.trim().split(" ")[0] : "Responsável";
  const patientFirstName = patientName?.trim() ? patientName.trim().split(" ")[0] : "Paciente";
  const surveyUrl = `${baseUrl}/familia/pesquisa`;

  const messageText = `Olá, ${guardianFirstName}! Como foi a experiência na 1ª Avaliação/Anamnese de ${patientFirstName}? Por favor, responda nossa pesquisa de satisfação: ${surveyUrl}`;

  return {
    guardianFirstName,
    patientFirstName,
    surveyUrl,
    messageText,
  };
}
