import { ShieldCheck, FileCheck, Lock } from "lucide-react";
import Link from "next/link";
import { CLINIC_TIMEZONE } from "@/lib/constants";

/**
 * "Auditoria" no portal do terapeuta = a trilha do prontuário DESTE
 * paciente, não a auditoria da clínica inteira (/gestor/auditoria é
 * gestor/supervisor apenas). Três fatos, cada um derivado de dado real:
 * assinatura, versionamento e a trilha LGPD via RPC
 * patient_record_access_trail (20260908190000) — nunca via SELECT direto em
 * record_access_log, que é gestor/supervisor apenas.
 */
export function AuditoriaPanel({
  patientId,
  signedNotesCount,
  totalNotesCount,
  versionedNotesCount,
  accessTrail,
}: {
  patientId: string;
  signedNotesCount: number;
  totalNotesCount: number;
  versionedNotesCount: number;
  accessTrail: { accessed_at: string; accessor_name: string; accessor_role: string; reason: string }[] | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4 bg-white shadow-sm" style={{ borderColor: "var(--color-neutral-200)" }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-1">
            <ShieldCheck size={14} className="text-emerald-600" /> Assinatura
          </div>
          <div className="text-lg font-bold text-emerald-700">
            {signedNotesCount} de {totalNotesCount}
          </div>
          <span className="text-[11px] text-ink-faint">evoluções assinadas</span>
        </div>

        <div className="rounded-xl border p-4 bg-white shadow-sm" style={{ borderColor: "var(--color-neutral-200)" }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-1">
            <FileCheck size={14} className="text-blue-600" /> Versionamento
          </div>
          <div className="text-lg font-bold text-blue-700">{versionedNotesCount} com histórico</div>
          <span className="text-[11px] text-ink-faint">edição gera nova versão, nunca sobrescreve</span>
        </div>

        <div className="rounded-xl border p-4 bg-white shadow-sm" style={{ borderColor: "var(--color-neutral-200)" }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-1">
            <Lock size={14} className="text-purple-600" /> Trilha LGPD (30 dias)
          </div>
          <div className="text-lg font-bold text-purple-700">
            {accessTrail === null ? "—" : `${accessTrail.length} acesso${accessTrail.length === 1 ? "" : "s"}`}
          </div>
          <span className="text-[11px] text-ink-faint">quem abriu este prontuário</span>
        </div>
      </div>

      {accessTrail && accessTrail.length > 0 && (
        <div className="rounded-xl border p-4 bg-white shadow-sm" style={{ borderColor: "var(--color-neutral-200)" }}>
          <h6 className="mb-2" style={{ color: "var(--color-accent-2-600)" }}>
            Quem acessou
          </h6>
          <div className="flex flex-col gap-1.5">
            {accessTrail.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink">
                  {a.accessor_name} <span className="text-ink-faint">· {a.accessor_role}</span>
                </span>
                <span className="text-ink-faint">
                  {new Date(a.accessed_at).toLocaleString("pt-BR", {
                    timeZone: CLINIC_TIMEZONE,
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href={`/terapeuta/paciente/${patientId}`} className="text-sm font-semibold text-accent hover:underline">
        Ver ficha completa do paciente →
      </Link>
    </div>
  );
}
