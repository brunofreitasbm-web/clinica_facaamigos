import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { AvalieForm } from "./avalie-form";

export const dynamic = "force-dynamic";

export default async function AvaliePage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <EmptyState title="Sessão não encontrada" message="Faça login novamente para avaliar a clínica." />;
  }

  const { data: patients } = await supabase.from("patients").select("id, full_name").order("full_name");
  const { patient: requestedPatientId } = await searchParams;
  const patient = (requestedPatientId && patients?.find((p) => p.id === requestedPatientId)) || patients?.[0] || null;

  if (!patient) {
    return (
      <EmptyState
        title="Nenhuma criança vinculada"
        message="Este responsável ainda não tem nenhum paciente vinculado. Fale com a recepção da clínica."
      />
    );
  }

  const { data: guardianRow } = await supabase
    .from("guardians")
    .select("id")
    .eq("patient_id", patient.id)
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: history } = guardianRow
    ? await supabase
        .from("family_feedback")
        .select("id, category_ratings, comments, created_at")
        .eq("patient_id", patient.id)
        .eq("guardian_id", guardianRow.id)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] as { id: string; category_ratings: Record<string, string>; comments: string | null; created_at: string }[] };

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col" style={{ background: "var(--color-bg)" }}>
      <header
        style={{
          background: "var(--color-dark)",
          color: "var(--color-paper)",
          padding: "20px 20px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <Link href={`/familia?patient=${patient.id}`} style={{ color: "var(--color-accent-2)", fontSize: 13, textDecoration: "none" }}>
          ← Voltar
        </Link>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 20 }}>Avalie</span>
        <span style={{ fontSize: 13, opacity: 0.8 }}>{patient.full_name}</span>
      </header>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        {guardianRow ? (
          <AvalieForm patientId={patient.id} guardianId={guardianRow.id} />
        ) : (
          <p className="text-sm text-ink-soft">Não encontramos seu vínculo de responsável para esta criança.</p>
        )}

        {(history ?? []).length > 0 && (
          <section className="flex flex-col gap-2">
            <h6 style={{ color: "var(--color-accent-2-600)" }}>Suas avaliações anteriores</h6>
            {(history ?? []).map((h) => (
              <div key={h.id} className="card flex flex-col gap-1">
                <span className="text-xs text-ink-faint">
                  {new Date(h.created_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE })}
                </span>
                {h.comments && <p className="text-sm text-ink" style={{ margin: 0 }}>{h.comments}</p>}
              </div>
            ))}
          </section>
        )}
      </div>

      <nav
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--color-surface)",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          padding: "10px 0 16px",
          fontSize: 11,
          borderTop: "1px solid var(--color-divider)",
        }}
      >
        <Link href={`/familia?patient=${patient.id}`} style={{ textAlign: "center", color: "var(--color-neutral-600)", textDecoration: "none" }}>Início</Link>
        <span style={{ textAlign: "center", color: "var(--color-neutral-600)" }}>Agenda</span>
        <span style={{ textAlign: "center", color: "var(--color-neutral-600)" }}>Progresso</span>
        <span style={{ textAlign: "center", color: "var(--color-neutral-600)" }}>Documentos</span>
        <span style={{ textAlign: "center", color: "var(--color-accent)", fontWeight: 600 }}>Avalie</span>
      </nav>
    </main>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h4>{title}</h4>
      <p style={{ color: "var(--color-neutral-600)", fontSize: 14 }}>{message}</p>
    </main>
  );
}
