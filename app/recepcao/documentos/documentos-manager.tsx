"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Printer,
  Copy,
  Check,
  User,
  Calendar,
  Building,
  ShieldCheck,
  Award,
  FileCheck,
  Sparkles,
} from "lucide-react";

export interface PatientOption {
  id: string;
  fullName: string;
  birthDate?: string | null;
  status?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianCpf?: string | null;
}

export interface ReceptionistProfile {
  id?: string;
  fullName: string;
  role?: string;
}

export interface ClinicInfo {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
}

const DEFAULT_CLINIC: ClinicInfo = {
  nomeFantasia: "Clínica Faça Amigos",
  razaoSocial: "Clínica TEA & TDAH Integrada Ltda",
  cnpj: "12.345.678/0001-90",
  telefone: "(11) 98765-4321",
  email: "contato@clinicafacaamigos.com.br",
  endereco: "Av. Paulista, 1000, Cj. 501 - Bela Vista, São Paulo/SP",
};

export type DocumentType =
  | "comparecimento_paciente"
  | "acompanhamento_responsavel"
  | "vinculo_terapeutico"
  | "frequencia_mensal"
  | "atestado_atendimento"
  | "autorizacao_retirada"
  | "declaracao_fiscal";

interface DocumentTemplateConfig {
  id: DocumentType;
  title: string;
  badge: string;
  icon: typeof FileText;
  description: string;
  defaultPurpose: string;
  defaultValidity: string;
}

const DOCUMENT_TEMPLATES: DocumentTemplateConfig[] = [
  {
    id: "comparecimento_paciente",
    title: "Declaração de Comparecimento (Paciente)",
    badge: "Mais Utilizado",
    icon: FileCheck,
    description: "Atesta a presença do paciente na clínica em dia e horário especificados.",
    defaultPurpose: "Justificativa de ausência escolar / acadêmica",
    defaultValidity: "Emissão na data",
  },
  {
    id: "acompanhamento_responsavel",
    title: "Declaração de Acompanhamento (Responsável)",
    badge: "Trabalhista",
    icon: ShieldCheck,
    description: "Atesta que o pai, mãe ou responsável legal acompanhou o menor durante a sessão.",
    defaultPurpose: "Justificativa de ausência no trabalho / abono de horas",
    defaultValidity: "Emissão na data",
  },
  {
    id: "vinculo_terapeutico",
    title: "Declaração de Vínculo Terapêutico",
    badge: "Matrícula / Convênio",
    icon: Award,
    description: "Comprova que o paciente realiza acompanhamento contínuo multidisciplinar na clínica.",
    defaultPurpose: "Comprovação para instituição de ensino ou convênio médico",
    defaultValidity: "60 dias",
  },
  {
    id: "frequencia_mensal",
    title: "Declaração de Frequência Mensal",
    badge: "Relatório de Assiduidade",
    icon: Calendar,
    description: "Resumo consolidado dos dias e horários em que o paciente compareceu no mês.",
    defaultPurpose: "Comprovação de assiduidade junto ao plano de saúde / plano terapêutico",
    defaultValidity: "Exercício atual",
  },
  {
    id: "atestado_atendimento",
    title: "Atestado de Atendimento Terapêutico",
    badge: "Saúde / Terapia",
    icon: FileText,
    description: "Atestado formal de atendimento de saúde e necessidade de repouso/afastamento temporário.",
    defaultPurpose: "Fins médicos / terapêuticos",
    defaultValidity: "Na data do atendimento",
  },
  {
    id: "autorizacao_retirada",
    title: "Autorização de Retirada de Menor",
    badge: "Segurança / Portaria",
    icon: User,
    description: "Termo onde o responsável legal autoriza um terceiro indicado a buscar o paciente.",
    defaultPurpose: "Autorização interna de saída e segurança do menor",
    defaultValidity: "Ano letivo / 12 meses",
  },
  {
    id: "declaracao_fiscal",
    title: "Declaração para Fins Fiscais (Imposto de Renda)",
    badge: "Financeiro / IR",
    icon: Building,
    description: "Comprovação dos atendimentos efetuados e valores quitados para dedução de IR.",
    defaultPurpose: "Declaração de Imposto de Renda Pessoa Física (DIRPF)",
    defaultValidity: "Ano-calendário de referência",
  },
];

export function DocumentosManager({
  patients,
  currentProfile,
  clinicInfo = DEFAULT_CLINIC,
}: {
  patients: PatientOption[];
  currentProfile?: ReceptionistProfile | null;
  clinicInfo?: ClinicInfo;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<DocumentType>("comparecimento_paciente");
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || "");
  const [copied, setCopied] = useState(false);

  const activeTemplate = DOCUMENT_TEMPLATES.find((t) => t.id === selectedTemplateId)!;
  const currentPatient = patients.find((p) => p.id === selectedPatientId);

  // Dynamic Form Fields State
  const todayIso = new Date().toISOString().split("T")[0];
  const [issueDate, setIssueDate] = useState<string>(todayIso);
  const [attendanceDate, setAttendanceDate] = useState<string>(todayIso);
  const [startTime, setStartTime] = useState<string>("14:00");
  const [endTime, setEndTime] = useState<string>("15:00");
  const [customPatientName, setCustomPatientName] = useState<string>(patients[0]?.fullName || "");
  const [customGuardianName, setCustomGuardianName] = useState<string>(patients[0]?.guardianName || "");
  const [guardianCpf, setGuardianCpf] = useState<string>(patients[0]?.guardianCpf || "");
  const [purpose, setPurpose] = useState<string>(activeTemplate.defaultPurpose);
  const [validity, setValidity] = useState<string>(activeTemplate.defaultValidity);
  const [receptionistName, setReceptionistName] = useState<string>(
    currentProfile?.fullName || "Recepção Faça Amigos",
  );
  const [disciplinesText, setDisciplinesText] = useState<string>(
    "Psicologia ABA, Terapia Ocupacional e Fonoaudiologia",
  );
  const [authorizedThirdPerson, setAuthorizedThirdPerson] = useState<string>("");
  const [authorizedThirdDocument, setAuthorizedThirdDocument] = useState<string>("");
  const [monthlySessionsCount, setMonthlySessionsCount] = useState<string>("12 sessões");
  const [referenceMonth, setReferenceMonth] = useState<string>("Setembro / 2026");
  const [observations, setObservations] = useState<string>("");

  // When patient selection changes, auto-fill names
  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    const p = patients.find((pat) => pat.id === id);
    if (p) {
      setCustomPatientName(p.fullName);
      setCustomGuardianName(p.guardianName || "");
      setGuardianCpf(p.guardianCpf || "");
    }
  };

  // Switch template reset defaults
  const handleSelectTemplate = (template: DocumentTemplateConfig) => {
    setSelectedTemplateId(template.id);
    setPurpose(template.defaultPurpose);
    setValidity(template.defaultValidity);
  };

  const patientNameDisplay =
    customPatientName.trim() || currentPatient?.fullName || "[Nome do Paciente]";

  const guardianNameDisplay =
    customGuardianName.trim() || currentPatient?.guardianName || "[Nome do Responsável]";

  const fmtDisplayDate = (isoStr: string) => {
    if (!isoStr) return "";
    const [y, m, d] = isoStr.split("-");
    if (!y || !m || !d) return isoStr;
    return `${d}/${m}/${y}`;
  };

  const fmtExtensoDate = (isoStr: string) => {
    if (!isoStr) return "";
    const dateObj = new Date(isoStr + "T12:00:00");
    return dateObj.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const docElement = document.getElementById("printable-document");
    if (docElement) {
      const text = docElement.innerText;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-[var(--color-bg)]">
      {/* Estilos CSS dedicados para Impressão limpa no papel A4 */}
      <style jsx global>{`
        @media print {
          /* Esconde todo o layout do sistema */
          body * {
            visibility: hidden;
          }
          /* Mostra apenas a folha de documento A4 */
          #printable-document,
          #printable-document * {
            visibility: visible;
          }
          #printable-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20mm !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            border-radius: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }
      `}</style>

      {/* Header da Recepção */}
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex h-16 items-center gap-7 px-6 sm:px-10 shadow-sm print:hidden"
      >
        <Link href="/recepcao" className="mr-auto flex items-center gap-3 no-underline">
          <svg width="30" height="30" viewBox="0 0 100 100" fill="none" aria-hidden>
            <path d="M22 18h34v10H33v18h20v10H33v26H22z" fill="var(--color-bg)" />
            <path
              d="M46 82 L64 26 h6 L88 82 h-9 l-4-13 H59 L55 82Z M61.5 61h11L67 42z"
              fill="var(--color-accent-2)"
            />
            <circle cx="33" cy="52.5" r="4.2" fill="var(--color-accent-2)" />
          </svg>
          <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
            Faça Amigos{" "}
            <span style={{ color: "var(--color-on-accent-soft)" }} className="font-normal italic">
              · Recepção
            </span>
          </span>
        </Link>
        <nav className="flex gap-6 text-[15px] font-semibold">
          <Link
            href="/recepcao"
            className="py-5 no-underline hover:opacity-100"
            style={{ color: "var(--color-on-accent-soft)" }}
          >
            Agenda
          </Link>
          <Link
            href="/recepcao/pacientes"
            className="py-5 no-underline hover:opacity-100"
            style={{ color: "var(--color-on-accent-soft)" }}
          >
            Pacientes
          </Link>
          <Link
            href="/recepcao/pacientes/pendencias"
            className="py-5 no-underline hover:opacity-100"
            style={{ color: "var(--color-on-accent-soft)" }}
          >
            Pendências
          </Link>
          <Link
            href="/recepcao/whatsapp"
            className="py-5 no-underline hover:opacity-100 flex items-center gap-1"
            style={{ color: "var(--color-on-accent-soft)" }}
          >
            <span>WhatsApp D-1</span>
          </Link>
          <span
            className="py-5"
            style={{
              borderBottom: "2px solid var(--color-on-accent)",
              color: "var(--color-on-accent)",
            }}
          >
            Documentos
          </span>
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-1 px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full flex flex-col gap-8 print:p-0">
        {/* Banner de Apresentação / Instrução */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm border border-black/5 print:hidden">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Emissão de Documentos Rápidos
              </h1>
              <p className="text-sm text-gray-500">
                Selecione o modelo, escolha o paciente para auto-preencher e imprima o documento oficial com timbre da clínica.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyText}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm shadow-pink-200 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Documento (A4)</span>
            </button>
          </div>
        </div>

        {/* Layout Grid: Seleção + Editor + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block">
          {/* Coluna Esquerda: Catálogo de Documentos + Formulário de Dados */}
          <div className="lg:col-span-5 flex flex-col gap-6 print:hidden">
            {/* Seção 1: Escolha do Modelo */}
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-black/5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-pink-500" />
                  1. Modelo de Documento
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-50 text-pink-700">
                  {DOCUMENT_TEMPLATES.length} modelos
                </span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {DOCUMENT_TEMPLATES.map((tmpl) => {
                  const IconComp = tmpl.icon;
                  const isSelected = tmpl.id === selectedTemplateId;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`text-left p-3.5 rounded-xl transition-all cursor-pointer border ${
                        isSelected
                          ? "border-pink-500 bg-pink-50/60 shadow-xs"
                          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/70"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 font-semibold text-sm text-gray-900">
                          <IconComp
                            className={`h-4 w-4 ${isSelected ? "text-pink-600" : "text-gray-400"}`}
                          />
                          <span>{tmpl.title}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isSelected
                              ? "bg-pink-600 text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {tmpl.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seção 2: Seleção do Paciente e Variáveis do Documento */}
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-black/5 flex flex-col gap-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <User className="h-4 w-4 text-pink-500" />
                2. Paciente & Dados da Emissão
              </h2>

              {/* Busca e Seletor de Paciente */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-700">
                  Selecionar Paciente Cadastrado
                </label>
                <div className="relative">
                  <select
                    value={selectedPatientId}
                    onChange={(e) => handleSelectPatient(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium text-gray-800 focus:bg-white focus:border-pink-500 focus:outline-none transition-all"
                  >
                    <option value="">-- Digitação Manual / Paciente Avulso --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} {p.guardianName ? `(Resp: ${p.guardianName})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Formulários dinâmicos baseados no tipo de documento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-gray-100">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700">
                    Nome Completo do Paciente
                  </label>
                  <input
                    type="text"
                    value={customPatientName}
                    onChange={(e) => setCustomPatientName(e.target.value)}
                    placeholder="Ex: Gabriel Santos Silva"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                  />
                </div>

                {(selectedTemplateId === "acompanhamento_responsavel" ||
                  selectedTemplateId === "autorizacao_retirada" ||
                  selectedTemplateId === "declaracao_fiscal") && (
                  <>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700">
                        Nome do Responsável Legal
                      </label>
                      <input
                        type="text"
                        value={customGuardianName}
                        onChange={(e) => setCustomGuardianName(e.target.value)}
                        placeholder="Ex: Maria das Graças Silva"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-700">
                        CPF / RG do Responsável
                      </label>
                      <input
                        type="text"
                        value={guardianCpf}
                        onChange={(e) => setGuardianCpf(e.target.value)}
                        placeholder="Ex: 123.456.789-00"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {selectedTemplateId === "autorizacao_retirada" && (
                  <>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700">
                        Nome da Pessoa Autorizada a Retirar
                      </label>
                      <input
                        type="text"
                        value={authorizedThirdPerson}
                        onChange={(e) => setAuthorizedThirdPerson(e.target.value)}
                        placeholder="Ex: Ana Paula Ferreira (Avó)"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-700">
                        Documento (RG/CPF) da Pessoa Autorizada
                      </label>
                      <input
                        type="text"
                        value={authorizedThirdDocument}
                        onChange={(e) => setAuthorizedThirdDocument(e.target.value)}
                        placeholder="Ex: RG 12.345.678-9 / SP"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Data do Atendimento / Evento
                  </label>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-700">Data de Emissão</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                  />
                </div>

                {(selectedTemplateId === "comparecimento_paciente" ||
                  selectedTemplateId === "acompanhamento_responsavel" ||
                  selectedTemplateId === "atestado_atendimento") && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-700">Horário Inicial</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-700">Horário Final</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {selectedTemplateId === "frequencia_mensal" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-700">Mês de Referência</label>
                      <input
                        type="text"
                        value={referenceMonth}
                        onChange={(e) => setReferenceMonth(e.target.value)}
                        placeholder="Ex: Setembro / 2026"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-700">Total de Sessões</label>
                      <input
                        type="text"
                        value={monthlySessionsCount}
                        onChange={(e) => setMonthlySessionsCount(e.target.value)}
                        placeholder="Ex: 16 sessões presenciais"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {selectedTemplateId === "vinculo_terapeutico" && (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-700">
                      Disciplinas / Especialidades Ativas
                    </label>
                    <input
                      type="text"
                      value={disciplinesText}
                      onChange={(e) => setDisciplinesText(e.target.value)}
                      placeholder="Ex: Psicologia ABA, Terapia Ocupacional, Fonoaudiologia"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700">
                    Finalidade do Documento
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Ex: Comprovação escolar ou empresarial"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Emitente / Recepcionista
                  </label>
                  <input
                    type="text"
                    value={receptionistName}
                    onChange={(e) => setReceptionistName(e.target.value)}
                    placeholder="Nome do recepcionista"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Validade do Documento
                  </label>
                  <input
                    type="text"
                    value={validity}
                    onChange={(e) => setValidity(e.target.value)}
                    placeholder="Ex: 30 dias / Válido na data"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700">
                    Observações / Informações Adicionais (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Ex: Paciente esteve acompanhado pelo responsável durante todo o período."
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-pink-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Visualização do Documento A4 (Pronto para Impressão) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {/* Container da Folha A4 com Sombra e Borda Institucional */}
            <div
              id="printable-document"
              className="w-full max-w-[794px] min-h-[1050px] bg-white rounded-2xl p-10 sm:p-14 shadow-xl border border-gray-200/80 flex flex-col justify-between text-gray-900 transition-all font-sans relative"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {/* Marca d'água discreta de impressão (apenas na tela) */}
              <div className="absolute top-4 right-4 print:hidden flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-pink-600 bg-pink-50 border border-pink-100 px-3 py-1 rounded-full uppercase">
                <Printer className="h-3.5 w-3.5" />
                <span>Pré-visualização A4</span>
              </div>

              {/* Cabeçalho Oficial / Timbre da Clínica */}
              <div>
                <div className="border-b-2 border-pink-600 pb-6 flex items-start justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-pink-600 text-white font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-md shadow-pink-200">
                      FA
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">
                        {clinicInfo.nomeFantasia}
                      </h3>
                      <p className="text-xs font-semibold text-pink-700">
                        {clinicInfo.razaoSocial}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        CNPJ: {clinicInfo.cnpj}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-600 leading-relaxed font-medium">
                    <p className="font-semibold text-gray-800">{clinicInfo.endereco}</p>
                    <p>Tel: {clinicInfo.telefone}</p>
                    <p>E-mail: {clinicInfo.email}</p>
                  </div>
                </div>

                {/* Título do Documento */}
                <div className="my-10 text-center">
                  <h2 className="text-xl font-bold uppercase tracking-widest text-gray-900 border-b border-gray-200 pb-3 inline-block px-6">
                    {activeTemplate.title}
                  </h2>
                </div>

                {/* Corpo do Documento - Texto Formal por Modelo */}
                <div className="space-y-6 text-base text-gray-800 leading-loose text-justify font-normal px-2">
                  {selectedTemplateId === "comparecimento_paciente" && (
                    <p>
                      Declaramos para os devidos fins de direito e comprovação que o(a) paciente{" "}
                      <strong className="font-bold text-gray-950">{patientNameDisplay}</strong>
                      compareceu a esta unidade de atendimento no dia{" "}
                      <strong className="font-bold text-gray-950">{fmtDisplayDate(attendanceDate)}</strong>
                      , no período compreendido das{" "}
                      <strong className="font-bold text-gray-950">{startTime}</strong> às{" "}
                      <strong className="font-bold text-gray-950">{endTime}</strong>, para a realização de sessões de acompanhamento terapêutico e multidisciplinar.
                    </p>
                  )}

                  {selectedTemplateId === "acompanhamento_responsavel" && (
                    <p>
                      Declaramos para os devidos fins de abono de horas e comprovação que o(a) Sr.(a){" "}
                      <strong className="font-bold text-gray-950">{guardianNameDisplay}</strong>
                      {guardianCpf && (
                        <span>
                          , inscrito(a) no CPF/RG nº{" "}
                          <strong className="font-bold text-gray-950">{guardianCpf}</strong>
                        </span>
                      )}
                      , esteve presente nesta instituição no dia{" "}
                      <strong className="font-bold text-gray-950">{fmtDisplayDate(attendanceDate)}</strong>
                      , no horário das{" "}
                      <strong className="font-bold text-gray-950">{startTime}</strong> às{" "}
                      <strong className="font-bold text-gray-950">{endTime}</strong>, acompanhando o(a) paciente menor sob sua responsabilidade,{" "}
                      <strong className="font-bold text-gray-950">{patientNameDisplay}</strong>, em consulta e plano de intervenção terapêutica.
                    </p>
                  )}

                  {selectedTemplateId === "vinculo_terapeutico" && (
                    <p>
                      Atestamos e declaramos para os devidos fins de direito que o(a) paciente{" "}
                      <strong className="font-bold text-gray-950">{patientNameDisplay}</strong>{" "}
                      mantém vínculo terapêutico ativo com a <strong className="font-bold text-gray-950">{clinicInfo.nomeFantasia}</strong>, encontrando-se regularmente em acompanhamento multidisciplinar especializado nas áreas de{" "}
                      <strong className="font-bold text-gray-950">{disciplinesText}</strong>, em regime contínuo de intervenção.
                    </p>
                  )}

                  {selectedTemplateId === "frequencia_mensal" && (
                    <p>
                      Declaramos que o(a) paciente{" "}
                      <strong className="font-bold text-gray-950">{patientNameDisplay}</strong>{" "}
                      teve frequência regular e assiduidade confirmada referente ao mês de{" "}
                      <strong className="font-bold text-gray-950">{referenceMonth}</strong>, cumprindo o total de{" "}
                      <strong className="font-bold text-gray-950">{monthlySessionsCount}</strong> pré-agendadas em seu plano terapêutico individualizado.
                    </p>
                  )}

                  {selectedTemplateId === "atestado_atendimento" && (
                    <p>
                      Atestamos para os devidos fins que o(a) paciente{" "}
                      <strong className="font-bold text-gray-950">{patientNameDisplay}</strong>{" "}
                      esteve em atendimento especializado nesta clínica no dia{" "}
                      <strong className="font-bold text-gray-950">{fmtDisplayDate(attendanceDate)}</strong>
                      , das <strong className="font-bold text-gray-950">{startTime}</strong> às{" "}
                      <strong className="font-bold text-gray-950">{endTime}</strong>, devendo ser dispensado(a) de suas atividades habituais durante o referido período.
                    </p>
                  )}

                  {selectedTemplateId === "autorizacao_retirada" && (
                    <p>
                      Por meio deste termo de autorização, o(a) responsável legal{" "}
                      <strong className="font-bold text-gray-950">{guardianNameDisplay}</strong>
                      {guardianCpf && <span> (CPF/RG: {guardianCpf})</span>} autoriza expressamente o(a) Sr.(a){" "}
                      <strong className="font-bold text-gray-950">
                        {authorizedThirdPerson || "[Nome da Pessoa Autorizada]"}
                      </strong>
                      {authorizedThirdDocument && (
                        <span>
                          , portador(a) do documento nº{" "}
                          <strong className="font-bold text-gray-950">{authorizedThirdDocument}</strong>
                        </span>
                      )}
                      , a retirar o(a) paciente menor{" "}
                      <strong className="font-bold text-gray-950">{patientNameDisplay}</strong> nas dependências desta clínica após o encerramento de suas sessões.
                    </p>
                  )}

                  {selectedTemplateId === "declaracao_fiscal" && (
                    <p>
                      Declaramos para fins de comprovação junto à Receita Federal (Imposto de Renda) que o(a) Sr.(a){" "}
                      <strong className="font-bold text-gray-950">{guardianNameDisplay}</strong>
                      {guardianCpf && <span> (CPF: {guardianCpf})</span>} realizou o pagamento dos serviços de atendimento em saúde e terapia prestados ao paciente{" "}
                      <strong className="font-bold text-gray-950">{patientNameDisplay}</strong>, no âmbito deste estabelecimento de saúde.
                    </p>
                  )}

                  {purpose && (
                    <p className="text-sm text-gray-700 bg-gray-50/80 p-3 rounded-lg border border-gray-200/60">
                      <strong className="font-semibold text-gray-900">Finalidade da Emissão:</strong> {purpose}.
                    </p>
                  )}

                  {observations && (
                    <p className="text-sm text-gray-700 bg-gray-50/80 p-3 rounded-lg border border-gray-200/60">
                      <strong className="font-semibold text-gray-900">Observações:</strong> {observations}
                    </p>
                  )}

                  <p className="text-sm text-gray-600">
                    Por ser verdade, firmamos o presente documento para que produza seus efeitos legais.
                  </p>
                </div>
              </div>

              {/* Data de Emissão + Bloco de Assinatura e Carimbo */}
              <div className="mt-16 pt-8 border-t border-gray-200">
                <div className="text-right text-sm font-semibold text-gray-800 mb-12">
                  São Paulo/SP, {fmtExtensoDate(issueDate)}.
                </div>

                <div className="grid grid-cols-2 gap-8 items-end">
                  {/* Linha de Assinatura do Emitente */}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-full border-b border-gray-900 mb-2"></div>
                    <span className="text-sm font-bold text-gray-900">{receptionistName}</span>
                    <span className="text-xs text-gray-600 font-medium">Recepção / Atendimento Ao Cliente</span>
                    <span className="text-[11px] text-gray-400 mt-0.5">{clinicInfo.nomeFantasia}</span>
                  </div>

                  {/* Espaço Reservado para Carimbo Físico da Clínica */}
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-4 min-h-[110px] text-center">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Espaço Reservado para Carimbo
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1">
                      (Assinatura física / Carimbo com CNPJ da clínica)
                    </span>
                  </div>
                </div>

                {/* Rodapé de Validade e Autenticidade */}
                <div className="mt-10 pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Documento gerado pelo Sistema de Gestão Clínica Faça Amigos</span>
                  <span>Validade: {validity}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
