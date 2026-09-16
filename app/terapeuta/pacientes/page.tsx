import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getTherapistPatients } from "@/lib/therapist-patients";

export const dynamic = "force-dynamic";

/**
 * Lista de pacientes do terapeuta — lista todos os pacientes que o terapeuta
 * tem atribuição na agenda ou atendeu anteriormente (lib/therapist-patients.ts).
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

  const patients = await getTherapistPatients(supabase, therapistId);

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <PageHeader axisLabel="Terapeuta" title="Meus pacientes" description="" />
      <div className="mx-auto grid w-full max-w-[640px] flex-1 grid-cols-1 gap-2 px-5 pt-4 sm:px-10 md:max-w-[900px] md:grid-cols-2 md:gap-3">
        {patients.length === 0 && (
          <p className="text-base text-ink-faint md:col-span-2">Nenhum paciente vinculado a você ainda.</p>
        )}
        {patients.map((p) => (
          <Link
            key={p.id}
            href={`/terapeuta/paciente/${p.id}`}
            className="flex items-center justify-between gap-2 border-b py-3.5 no-underline md:rounded-xl md:border md:border-paper-line md:bg-paper md:px-4 md:py-3.5 md:shadow-2xs md:transition md:hover:border-accent-1 md:hover:bg-paper-surface"
            style={{ borderColor: "var(--color-divider)", color: "var(--color-text)" }}
          >
            <span className="text-[15px] font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
              {p.full_name}
            </span>
            <span className="text-sm text-ink-faint">Ver ficha →</span>
          </Link>
        ))}
      </div>

    </main>
  );
}
