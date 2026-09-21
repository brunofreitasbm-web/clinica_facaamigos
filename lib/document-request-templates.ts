import { CLINIC_BRAND } from "@/lib/clinic-identity";

/**
 * Cobranças de documento pendente disparadas em um clique pela recepção/
 * supervisão (fila de pendências, cartão do contato).
 *
 * O texto mora aqui e não no componente porque ele é auditável: cada envio
 * grava `messages.template_key = documento_pendente:<key>`, e é por essa
 * chave que a fila mostra "já cobrado em …" na volta (ver
 * getDraftDocumentRequests em lib/reception-queue.ts). Mudar o `key` de um
 * item existente apaga o histórico de cobrança dele na tela — acrescente um
 * item novo em vez de renomear.
 *
 * Todo texto fecha com o mesmo motivo (o pedido de autorização junto ao
 * plano fica parado sem o documento): é o que faz a família responder, e é a
 * informação que a recepção repetia à mão em cada conversa.
 */
export const MISSING_DOCUMENT_TEMPLATES = [
  {
    key: "laudo_medico",
    label: "Laudo médico",
    // Primeiro da lista de propósito: é a cobrança recorrente do dia a dia —
    // sem laudo com CID o convênio nem abre a análise da autorização.
    documentName: "*laudo médico* (com o CID)",
  },
  {
    key: "pedido_medico",
    label: "Pedido médico",
    documentName: "*pedido médico* atualizado, com o CID e a quantidade de sessões",
  },
  {
    key: "carteirinha",
    label: "Carteirinha",
    documentName: "*carteirinha do plano de saúde* (frente e verso, com a validade legível)",
  },
  {
    key: "documento_responsavel",
    label: "Doc. do responsável",
    documentName: "*documento do responsável* (RG ou CNH, com CPF)",
  },
  {
    key: "certidao_nascimento",
    label: "Certidão de nascimento",
    documentName: "*certidão de nascimento da criança*",
  },
  {
    key: "comprovante_residencia",
    label: "Comprovante de residência",
    documentName: "*comprovante de residência* dos últimos 3 meses",
  },
] as const;

export type MissingDocumentTemplate = (typeof MISSING_DOCUMENT_TEMPLATES)[number];
export type MissingDocumentKey = MissingDocumentTemplate["key"];

export const TEMPLATE_KEY_PREFIX = "documento_pendente:";

export function templateKeyFor(key: MissingDocumentKey): string {
  return `${TEMPLATE_KEY_PREFIX}${key}`;
}

/** `documento_pendente:laudo_medico` -> `laudo_medico` (null se não for uma cobrança). */
export function parseTemplateKey(raw: string | null | undefined): MissingDocumentKey | null {
  if (!raw || !raw.startsWith(TEMPLATE_KEY_PREFIX)) return null;
  const key = raw.slice(TEMPLATE_KEY_PREFIX.length);
  return MISSING_DOCUMENT_TEMPLATES.some((t) => t.key === key) ? (key as MissingDocumentKey) : null;
}

export function findMissingDocumentTemplate(key: string): MissingDocumentTemplate | null {
  return MISSING_DOCUMENT_TEMPLATES.find((t) => t.key === key) ?? null;
}

/**
 * Mensagem enviada à família. `patientName` é opcional porque o contato pode
 * estar na fila antes de existir paciente cadastrado (rascunho recém-chegado
 * pelo WhatsApp) — sem nome, o texto fala só "da criança".
 */
export function buildMissingDocumentMessage(
  template: MissingDocumentTemplate,
  patientName?: string | null,
): string {
  const first = patientName?.trim().split(/\s+/)[0];
  const child = first ? `do(a) ${first}` : "da criança";
  return [
    `Olá! Aqui é da ${CLINIC_BRAND}. 💙`,
    "",
    `Para darmos início ao processo de autorização ${child} junto ao plano de saúde, ainda está faltando o ${template.documentName}.`,
    "",
    "Pode enviar por aqui mesmo: uma foto legível ou o PDF já resolve.",
    "",
    "Enquanto esse documento não chega, o pedido de autorização fica parado e não conseguimos agendar o início do atendimento. Qualquer dúvida, é só responder nesta conversa. 🙂",
  ].join("\n");
}
