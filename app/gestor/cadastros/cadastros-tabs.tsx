"use client";

import { useState } from "react";
import Link from "next/link";
import type { TherapistRow, InsurerRow, ProtocolRow, PatientRow } from "./data";

const TABS = [
  { key: "terapeutas", label: "Terapeutas" },
  { key: "planos", label: "Planos de saúde" },
  { key: "terapias", label: "Terapias" },
  { key: "pacientes", label: "Pacientes" },
] as const;

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
}: {
  therapists: TherapistRow[];
  insurers: InsurerRow[];
  protocols: ProtocolRow[];
  patients: PatientRow[];
}) {
  const [tab, setTab] = useState<TabKey>("terapeutas");

  const counts: Record<TabKey, number> = {
    terapeutas: therapists.length,
    planos: insurers.length,
    terapias: protocols.length,
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
                <th></th>
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
                    <Link href="/gestor/equipe" className="btn btn-ghost text-xs">
                      Editar
                    </Link>
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
                <th></th>
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
                    <Link href={`/gestor/convenios/${i.id}/precos`} className="btn btn-ghost text-xs">
                      Tabela de preços
                    </Link>
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
                  <th></th>
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
                      <Link href={`/gestor/protocolos/${p.id}`} className="btn btn-ghost text-xs">
                        Gerenciar itens
                      </Link>
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
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">
                    <Link href={`/recepcao/pacientes/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>{p.guardianName}</td>
                  <td>{p.birthDateLabel}</td>
                  <td>{p.insurerName}</td>
                  <td>{p.primaryTherapistName}</td>
                  <td>
                    <span className={`tag-status ${PATIENT_STATUS_TAG[p.status] ?? "st-cancelada"}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-ink-faint">
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
