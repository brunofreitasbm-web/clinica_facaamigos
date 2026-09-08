import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ShieldCheck, FileCheck, Search, Hash, Lock, Printer, Download } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProntuarioUnificadoPage() {
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, cpf, birth_date, status")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name", { ascending: true })
    .limit(10);

  const patientList = patients ?? [];

  // Mocks para simulação visual de Prontuário Unificado e Auditoria
  const mockTimeline = [
    {
      id: "1",
      date: "07/09/2026 14:30",
      type: "Evolução Clínica (Psicologia/ABA)",
      author: "Dra. Ana Paula (CRP 06/123456)",
      summary: "Sessão focada em comunicação funcional e redução de comportamentos de esquiva. Aumentou tempo de engajamento em 15 min.",
      hash: "a3f89b1c7e2d4f5a...8e9d",
      signed: true
    },
    {
      id: "2",
      date: "05/09/2026 10:00",
      type: "Plano Terapêutico Singular (PTS)",
      author: "Coordenação Clínica",
      summary: "Atualização de metas semestrais: Adicionados 3 novos alvos no VB-MAPP (Intraverbal 6M e Ecolalia).",
      hash: "b7c2d9e1f3a4...001a",
      signed: true
    },
    {
      id: "3",
      date: "01/09/2026 09:15",
      type: "Avaliação Fonoaudiológica",
      author: "Dra. Juliana Lima (CRFa 2-9876)",
      summary: "Protocolo de Comunicação Alternativa Aplicado. Indicada introdução de PECS Fase II.",
      hash: "c9d8e7f6a5b4...4411",
      signed: true
    }
  ];

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      {/* Header Navy Broadsheet */}
      <header style={{ background: "var(--color-accent)", color: "var(--color-bg)" }} className="flex h-16 items-center justify-between px-10">
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: "var(--font-heading)" }} className="text-[17px] font-semibold">
            Faça Amigos <span style={{ color: "var(--color-on-accent-soft)" }} className="font-normal italic">· Audit Clínico & Prontuário</span>
          </span>
        </div>
        <Link href="/supervisao" className="btn btn-secondary text-xs">
          Voltar para Supervisão
        </Link>
      </header>

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Conformidade Regulatória CFP / ANS / LGPD
            </h6>
            <h1 className="m-0">Prontuário Eletrônico Unificado & Trilha de Auditoria</h1>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary flex items-center gap-2">
              <Printer size={16} /> Imprimir Prontuário Completo
            </button>
            <button className="btn btn-primary flex items-center gap-2">
              <Download size={16} /> Exportar Laudo Auditado (PDF)
            </button>
          </div>
        </div>

        {/* Seleção de Paciente e Painel de Auditoria */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <h4 className="mb-3">Selecionar Paciente</h4>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 text-ink-faint" size={16} />
              <input type="text" placeholder="Nome ou CPF..." className="input pl-9 text-xs" />
            </div>

            <div className="flex flex-col gap-2">
              {patientList.slice(0, 5).map((p: any, idx: number) => (
                <button
                  key={p.id}
                  className={`p-3 text-left rounded-lg border text-xs transition-all ${idx === 0 ? 'border-amber-500 bg-amber-50/50 font-semibold' : 'border-neutral-200 hover:bg-neutral-50'}`}
                >
                  <div>{p.full_name}</div>
                  <div className="text-[11px] text-ink-faint">CPF: {p.cpf || '***.***.***-**'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Cards de Conformidade Legal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border p-5 bg-white shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink-faint mb-1">
                  <ShieldCheck size={16} className="text-emerald-600" /> Integridade Hash SHA-256
                </div>
                <div className="text-lg font-bold text-emerald-700">100% Imutável</div>
                <span className="text-[11px] text-ink-faint">Todos os registros selados no banco</span>
              </div>

              <div className="rounded-xl border p-5 bg-white shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink-faint mb-1">
                  <FileCheck size={16} className="text-blue-600" /> Assinaturas Técnicas
                </div>
                <div className="text-lg font-bold text-blue-700">Conforme CFP nº 01/2009</div>
                <span className="text-[11px] text-ink-faint">Evoluções com registro profissional</span>
              </div>

              <div className="rounded-xl border p-5 bg-white shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-ink-faint mb-1">
                  <Lock size={16} className="text-purple-600" /> Sigilo & LGPD
                </div>
                <div className="text-lg font-bold text-purple-700">Acesso Restrito</div>
                <span className="text-[11px] text-ink-faint">Trilha de auditoria ativa</span>
              </div>
            </div>

            {/* Timeline do Prontuário */}
            <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
              <h3 className="mb-6 flex items-center gap-2">
                <Hash size={18} className="text-amber-600" /> Histórico Unificado do Paciente
              </h3>

              <div className="flex flex-col gap-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
                {mockTimeline.map((item) => (
                  <div key={item.id} className="flex gap-4 relative">
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 z-10">
                      ✓
                    </div>
                    <div className="flex-1 rounded-lg border p-4 bg-neutral-50/50">
                      <div className="flex flex-wrap justify-between items-baseline mb-1">
                        <span className="font-bold text-sm">{item.type}</span>
                        <span className="tabular-figure text-xs text-ink-faint">{item.date}</span>
                      </div>
                      <div className="text-xs font-medium text-amber-800 mb-2">{item.author}</div>
                      <p className="text-xs text-ink-soft mb-3">{item.summary}</p>
                      <div className="flex items-center justify-between text-[11px] text-ink-faint pt-2 border-t border-neutral-200">
                        <span className="font-mono">Hash de Auditoria: {item.hash}</span>
                        <span className="tag-status st-realizada">Assinado & Selado</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
