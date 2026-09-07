import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TerapeutaBottomNav } from "@/components/terapeuta-bottom-nav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lista de pacientes do terapeuta — faltava desde sempre: o item "Pacientes"
 * da navegação inferior (app/terapeuta/page.tsx) era um <span> sem link, e
 * as páginas /terapeuta/paciente/[id]/{metricas,avaliacao,relatorio,
 * relatorio-convenio} não tinham nenhuma porta de entrada dentro do app.
 */
export default async function TerapeutaPacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ therapist?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const canChooseTherapist = profile?.role === "gestor" || profile?.role === "supervisor";
  if (!profile || (profile.role !== "terapeuta" && !canChooseTherapist)) {
    redirect("/");
  }

  let therapistId = profile.id;
  if (canChooseTherapist) {
    const { therapist: requestedTherapistId } = await searchParams;
    if (requestedTherapistId) therapistId = requestedTherapistId;
  }

  const { data: access } = await supabase
    .from("patient_access")
    .select("patient_id, patients(id, full_name, status)")
    .eq("profile_id", therapistId)
    .eq("access_type", "terapeuta")
    .is("revoked_at", null);

  const patients = (access ?? [])
    .map((a) => (Array.isArray(a.patients) ? a.patients[0] : a.patients))
    .filter((p): p is { id: string; full_name: string; status: string } => !!p)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <main className="flex flex-1 flex-col pb-20">
      <PageHeader axisLabel="Terapeuta" title="Meus pacientes" description="" />
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-2 px-5 pt-4 sm:px-10">
        {patients.length === 0 && (
          <p className="text-sm text-ink-faint">Nenhum paciente vinculado a você ainda.</p>
        )}
        {patients.map((p) => (
          <Link
            key={p.id}
            href={`/terapeuta/paciente/${p.id}`}
            className="flex items-center justify-between gap-2 border-b py-3.5 no-underline"
            style={{ borderColor: "var(--color-divider)", color: "var(--color-text)" }}
          >
            <span className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              {p.full_name}
            </span>
            <span className="text-xs text-ink-faint">Ver ficha →</span>
          </Link>
        ))}
      </div>

      <TerapeutaBottomNav active="pacientes" />
    </main>
  );
}
