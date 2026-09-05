"use client";

import { useState } from "react";
import Link from "next/link";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import type { TherapistRow, InsurerRow, ProtocolRow, PatientRow, AppointmentTypeRow } from "./data";

const TABS = [
  { key: "terapeutas", label: "Terapeutas" },
  { key: "planos", label: "Planos de saúde" },
  { key: "terapias", label: "Terapias" },
  { key: "atendimentos", label: "Atendimentos" },
  { key: "pacientes", label: "Pacientes" },
] as const;

const MODALITY_LABEL: Record<string, string> = { presencial: "Presencial", remoto: "Remoto" };
const RECURRENCE_LABEL: Record<string, string> = { unica: "Única", semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal" };

type TabKey = (typeof TABS)[number]["key"];

const PATIENT_STATUS_TAG: Record<string, string> = {
  lead: "st-agendada",
  avaliacao: "st-agendada",
  ativo: "st-realizada",
  pausado: "st-em-atendimento",
  alta: "st-confirmada",
  evadido: "st-falta",
};

export function CadastrosTabs({
  therapists,
  insurers,
  protocols,
  patients,
  appointmentTypes,
}: {
  therapists: TherapistRow[];
  insurers: InsurerRow[];
  protocols: ProtocolRow[];
  patients: PatientRow[];
  appointmentTypes: AppointmentTypeRow[];
}) {
  const [tab, setTab] = useState<TabKey>("terapeutas");

  const counts: Record<TabKey, number> = {
    terapeutas: therapists.length,
    planos: insurers.length,
    terapias: protocols.length,
    atendimentos: appointmentTypes.length,
    pacientes: patients.length,
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 px-10 pt-8">
        <div className="seg w-fit">
          {TABS.map((t) => (
            <label key={t.key} className="seg-opt">
              <input type="radio" name="cadastros-tab" checked={tab === t.key} onChange={() => setTab(t.key)} />
              {t.label} · {counts[t.key]}
            </label>
          ))}
        </div>
        {tab === "terapeutas" && (
          <Link href="/gestor/equipe" className="btn btn-primary">
            Novo terapeuta
          </Link>
        )}
        {tab === "planos" && (
          <Link href="/gestor/convenios" className="btn btn-primary">
            Novo convênio
          </Link>
        )}
        {tab === "atendimentos" && (
          <Link href="/gestor/atendimentos" className="btn btn-primary">
            Novo tipo de atendimento
          </Link>
        )}
        {tab === "pacientes" && (
          <Link href="/recepcao/pacientes/novo" className="btn btn-primary">
            Novo paciente
          </Link>
        )}
      </div>

      <main className="px-10 pb-16 pt-8">
        {tab === "terapeutas" && (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Disciplina</th>
                <th>Faixa</th>
                <th>Contrato</th>
                <th>Certificações</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {therapists.map((t) => (
                <tr key={t.id}>
                  <td className="font-semibold">
                    {t.name}
                    {!t.active && <span className="tag-status st-cancelada ml-2">Inativo</span>}
                  </td>
                  <td>{t.discipline}</td>
                  <td>{t.tier}</td>
                  <td>{t.contractLabel}</td>
                  <td>{t.certifications}</td>
                  <td className="text-right">
                    <QuickActionsBar
                      finance={{ href: "/gestor/financeiro", title: `Financeiro/Repasse de ${t.name}` }}
                      profile={{ href: "/gestor/equipe", title: `Ficha de ${t.name}` }}
                      edit={{ href: "/gestor/equipe", title: `Editar ${t.name}` }}
                      schedule={{ href: "/gestor/atendimentos", title: `Agenda de ${t.name}` }}
                    />
                  </td>
                </tr>
              ))}
              {therapists.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-ink-faint">
                    Nenhum terapeuta cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "planos" && (
          <table className="table">
            <thead>
              <tr>
                <th>Convênio</th>
                <th>Tabela vigente</th>
                <th>Preços cadastrados</th>
                <th>Glosas em aberto</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {insurers.map((i) => (
                <tr key={i.id}>
                  <td className="font-semibold">
                    {i.name}
                    {i.ansCode && <span className="ml-2 text-ink-faint">ANS {i.ansCode}</span>}
                  </td>
                  <td>
                    <span className={`tag-status ${i.hasCurrentPriceTable ? "st-realizada" : "st-falta"}`}>
                      {i.hasCurrentPriceTable ? "Vigente" : "Sem tabela"}
                    </span>
                  </td>
                  <td className="tabular-figure">{i.priceCount}</td>
                  <td className="tabular-figure">{i.openGlosasCount}</td>
                  <td className="text-right">
                    <QuickActionsBar
                      finance={{ href: `/gestor/convenios/${i.id}/precos`, title: `Preços do convênio ${i.name}` }}
                      profile={{ href: `/gestor/convenios`, title: `Ver convênio ${i.name}` }}
                      edit={{ href: `/gestor/convenios`, title: `Editar convênio ${i.name}` }}
                      schedule={{ href: `/faturamento/guias`, title: `Guias do convênio ${i.name}` }}
                    />
                  </td>
                </tr>
              ))}
              {insurers.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-ink-faint">
                    Nenhum convênio cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "terapias" && (
          <>
            <p className="mb-4 max-w-[720px] text-[13px] text-ink-soft">
              Protocolos licenciados (VB-MAPP, ABLLS-R, Denver/ESDM) — cadastro é decisão jurídica do gestor (PRD
              §9.4-A), sem fluxo de criação nesta tela.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Versão</th>
                  <th>Licença comprada em</th>
                  <th>Risco de digitização aceito por</th>
                  <th>Itens cadastrados</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {protocols.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.name}</td>
                    <td>{p.version ?? "—"}</td>
                    <td>{p.licensePurchasedAtLabel}</td>
                    <td>{p.riskAcceptedLabel}</td>
                    <td className="tabular-figure">{p.itemCount}</td>
                    <td className="text-right">
                      <QuickActionsBar
                        profile={{ href: `/gestor/protocolos/${p.id}`, title: `Ver ${p.name}` }}
                        edit={{ href: `/gestor/protocolos/${p.id}`, title: `Gerenciar ${p.name}` }}
                        schedule={{ href: `/gestor/protocolos/${p.id}`, title: `Histórico de ${p.name}` }}
                      />
                    </td>
                  </tr>
                ))}
                {protocols.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-ink-faint">
                      Nenhum protocolo licenciado cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {tab === "atendimentos" && (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Modalidade</th>
                <th>Duração</th>
                <th>Exibição</th>
                <th>Recorrência</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {appointmentTypes.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">{a.name}</td>
                  <td>{MODALITY_LABEL[a.modality] ?? a.modality}</td>
                  <td>{a.durationMinutes}m</td>
                  <td>A cada {a.displayIntervalMinutes} minutos</td>
                  <td>{RECURRENCE_LABEL[a.recurrence] ?? a.recurrence}</td>
                  <td className="text-right">
                    <QuickActionsBar
                      finance={{ href: "/gestor/financeiro", title: `Valores de ${a.name}` }}
                      profile={{ href: "/gestor/atendimentos", title: `Ver ${a.name}` }}
                      edit={{ href: "/gestor/atendimentos", title: `Editar ${a.name}` }}
                      schedule={{ href: "/gestor/atendimentos", title: `Escala de ${a.name}` }}
                    />
                  </td>
                </tr>
              ))}
              {appointmentTypes.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-ink-faint">
                    Nenhum tipo de atendimento cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "pacientes" && (
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Responsável</th>
                <th>Nascimento</th>
                <th>Convênio</th>
                <th>Terapeuta principal</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">
                    <Link href={`/gestor/pacientes/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>{p.guardianName}</td>
                  <td>{p.birthDateLabel}</td>
                  <td>{p.insurerName}</td>
                  <td>{p.primaryTherapistName}</td>
                  <td>
                    <span className={`tag-status ${PATIENT_STATUS_TAG[p.status] ?? "st-cancelada"}`}>{p.status}</span>
                  </td>
                  <td className="text-right">
                    <QuickActionsBar
                      profile={{ href: `/gestor/pacientes/${p.id}`, title: `Ficha completa de ${p.name}` }}
                      edit={{ href: `/gestor/pacientes/${p.id}`, title: `Editar paciente ${p.name}` }}
                      schedule={{ href: `/gestor/pacientes/${p.id}`, title: `Agenda de ${p.name}` }}
                    />
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-ink-faint">
                    Nenhum paciente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
