/**
 * Pré-validação de lote TISS — roda ANTES de `generateTissXml` (xml-builder.ts)
 * para pegar os erros mais comuns de glosa enquanto ainda dá tempo de corrigir,
 * em vez de descobrir só quando a operadora devolve o lote semanas depois.
 *
 * Só LEITURA: recebe os dados já buscados do banco (via getPendingGuias) e faz
 * checagens puramente em memória/TypeScript — não abre conexão nova com o banco
 * nem grava nada em lugar nenhum.
 *
 * As checagens abaixo cobrem:
 *  (a) os campos que `generateTissXml` hoje assume presentes e não valida —
 *      se saírem vazios o XML é gerado mas tecnicamente inválido/incompleto
 *      (carteirinha, nome do beneficiário, código do procedimento, data do
 *      atendimento, código do prestador na operadora);
 *  (b) a mesma regra do trigger `billing_items_requires_session_note`
 *      (supabase/migrations/20260904000009_billing.sql e
 *      20260904000014_final_review_fixes.sql) — aqui exigimos além da
 *      existência da nota, que ela esteja assinada (`signed_at`), porque nota
 *      não assinada é motivo comum de glosa em auditoria;
 *  (c) guia (`authorizations`) vencida, negada, esgotada ou sem sessões
 *      restantes na data da sessão faturada;
 *  (d) procedimento sem correspondência na tabela de preços do convênio
 *      (`insurer_price_tables`) — sinal de que o código não está contratado;
 *  (e) carteirinha do convênio vencida na data do atendimento.
 *
 * Observação: no banco real (projeto vththexblpxwocbowhsv) a tabela `glosas`
 * está zerada hoje (ambiente ainda em fase de testes/implantação), então não
 * há histórico de `reason_code` real pra ranquear. As checagens abaixo foram
 * priorizadas pelos erros estruturalmente mais comuns em glosa TISS (campo
 * obrigatório vazio, guia vencida/esgotada, procedimento fora de tabela,
 * ausência de assinatura) — quando a tabela `glosas` começar a acumular
 * dados reais, vale reabrir esse arquivo e reordenar/ajustar pesos conforme
 * o `reason_code` mais frequente observado em produção.
 */

import type { TissGuiaItem } from "./xml-builder";

export type TissIssueSeverity = "bloqueante" | "aviso";

export type TissValidationIssue = {
  billingItemId: string;
  appointmentId: string | null;
  patientId: string | null;
  severity: TissIssueSeverity;
  code: string;
  message: string;
};

/**
 * Dados adicionais (além dos campos já usados por `generateTissXml`) que a
 * pré-validação precisa pra checar guia/sessão/tabela de preços. É um
 * superset de `TissGuiaItem` — passar `TissValidationItem[]` onde se espera
 * `TissGuiaItem[]` funciona normalmente (campos extras são ignorados pelo
 * gerador de XML).
 */
export interface TissValidationItem extends TissGuiaItem {
  appointmentId: string | null;
  patientId: string | null;
  codigoPrestador: string;
  hasSessionNote: boolean;
  sessionNoteSignedAt: string | null;
  authorization: {
    status: string;
    validFrom: string | null;
    validTo: string | null;
    sessionsAuthorized: number;
    sessionsUsed: number;
  } | null;
  cardValidUntil: string | null;
  procedureInPriceTable: boolean;
}

const SESSOES_RESTANTES_AVISO = 2; // avisa quando faltam <= 2 sessões pra esgotar a guia
const DIAS_VENCIMENTO_AVISO = 15; // avisa quando a guia/carteirinha vence em <= 15 dias da sessão

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function issue(
  item: TissValidationItem,
  severity: TissIssueSeverity,
  code: string,
  message: string,
): TissValidationIssue {
  return {
    billingItemId: item.id,
    appointmentId: item.appointmentId,
    patientId: item.patientId,
    severity,
    code,
    message,
  };
}

/**
 * Roda a pré-validação sobre os itens de um lote (ou seleção de itens) e
 * devolve a lista de problemas encontrados, um item pode gerar mais de um
 * problema. Não lança exceção — quem chama decide o que fazer com
 * `severity === 'bloqueante'`.
 */
export function preValidateTissBatch(items: TissValidationItem[]): TissValidationIssue[] {
  const problems: TissValidationIssue[] = [];

  for (const item of items) {
    const paciente = item.nomeBeneficiario?.trim();

    // (a) campos obrigatórios do XML que generateTissXml não checa
    if (!paciente || paciente === "—") {
      problems.push(issue(item, "bloqueante", "campo_obrigatorio_faltando", "Nome do beneficiário está vazio."));
    }
    if (!item.numeroCarteira?.trim()) {
      problems.push(
        issue(item, "bloqueante", "campo_obrigatorio_faltando", "Número da carteirinha do convênio está vazio."),
      );
    }
    if (!item.procedimentoCodigo?.trim()) {
      problems.push(issue(item, "bloqueante", "campo_obrigatorio_faltando", "Código do procedimento (TUSS) está vazio."));
    }
    if (!item.dataAtendimento?.trim()) {
      problems.push(issue(item, "bloqueante", "campo_obrigatorio_faltando", "Data do atendimento está vazia."));
    }
    if (!item.codigoPrestador?.trim()) {
      problems.push(
        issue(
          item,
          "bloqueante",
          "campo_obrigatorio_faltando",
          "Código do prestador na operadora não está cadastrado para este convênio (cadastre em Gestor → Convênios).",
        ),
      );
    }
    if (item.numeroGuiaPrestador.startsWith("SEM-GUIA-")) {
      problems.push(
        issue(
          item,
          "bloqueante",
          "sem_autorizacao_vinculada",
          "Sessão sem guia de autorização vinculada — um número de guia fictício seria enviado à operadora.",
        ),
      );
    }

    // (b) nota de sessão (mesma exigência do trigger billing_items_requires_session_note, + assinatura)
    if (!item.hasSessionNote) {
      problems.push(
        issue(item, "bloqueante", "sem_evolucao", "Sessão faturada sem evolução (session_notes) registrada."),
      );
    } else if (!item.sessionNoteSignedAt) {
      problems.push(
        issue(
          item,
          "bloqueante",
          "evolucao_nao_assinada",
          "Evolução da sessão ainda não foi assinada pelo terapeuta — risco de glosa em auditoria.",
        ),
      );
    }

    // (c) guia (authorizations) vencida/negada/esgotada/sem sessões na data faturada
    const auth = item.authorization;
    if (auth && item.dataAtendimento) {
      if (auth.status === "negada") {
        problems.push(issue(item, "bloqueante", "guia_negada", "Guia de autorização foi negada pela operadora."));
      }
      if (auth.status === "vencida" || (auth.validTo && item.dataAtendimento > auth.validTo)) {
        problems.push(
          issue(item, "bloqueante", "guia_vencida", `Guia estava vencida na data do atendimento (válida até ${auth.validTo ?? "—"}).`),
        );
      } else if (auth.validTo) {
        const diasParaVencer = daysBetween(item.dataAtendimento, auth.validTo);
        if (diasParaVencer >= 0 && diasParaVencer <= DIAS_VENCIMENTO_AVISO) {
          problems.push(
            issue(item, "aviso", "guia_perto_de_vencer", `Guia vence em ${diasParaVencer} dia(s) a partir da data desta sessão.`),
          );
        }
      }

      if (auth.status === "esgotada" || auth.sessionsUsed >= auth.sessionsAuthorized) {
        problems.push(
          issue(item, "bloqueante", "guia_sem_sessoes", "Guia sem sessões restantes autorizadas para esta sessão."),
        );
      } else {
        const restantes = auth.sessionsAuthorized - auth.sessionsUsed;
        if (restantes <= SESSOES_RESTANTES_AVISO) {
          problems.push(
            issue(item, "aviso", "guia_perto_do_limite", `Guia perto do limite: restam ${restantes} sessão(ões) autorizada(s).`),
          );
        }
      }
    } else if (!item.numeroGuiaPrestador.startsWith("SEM-GUIA-")) {
      // tem número de guia mas não achamos os dados de authorizations pra cruzar — não é erro
      // certo o suficiente pra bloquear, mas vale avisar que não deu pra checar limite/validade.
      problems.push(
        issue(item, "aviso", "guia_sem_dados_para_checagem", "Não foi possível localizar os dados completos da guia para checar validade/limite de sessões."),
      );
    }

    // (d) procedimento sem correspondência na tabela de preços do convênio
    if (!item.procedureInPriceTable) {
      problems.push(
        issue(
          item,
          "bloqueante",
          "procedimento_fora_da_tabela",
          `Procedimento ${item.procedimentoCodigo} não consta na tabela de preços vigente do convênio ${item.nomeConvenio} — operadora tende a glosar por falta de cobertura contratual.`,
        ),
      );
    }

    // (e) carteirinha vencida na data do atendimento
    if (item.cardValidUntil && item.dataAtendimento) {
      if (item.dataAtendimento > item.cardValidUntil) {
        problems.push(
          issue(item, "bloqueante", "carteirinha_vencida", `Carteirinha do convênio estava vencida na data do atendimento (válida até ${item.cardValidUntil}).`),
        );
      } else {
        const diasParaVencer = daysBetween(item.dataAtendimento, item.cardValidUntil);
        if (diasParaVencer >= 0 && diasParaVencer <= DIAS_VENCIMENTO_AVISO) {
          problems.push(
            issue(item, "aviso", "carteirinha_perto_de_vencer", `Carteirinha vence em ${diasParaVencer} dia(s) a partir da data desta sessão.`),
          );
        }
      }
    }
  }

  return problems;
}

export function hasBlockingIssues(issues: TissValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "bloqueante");
}
