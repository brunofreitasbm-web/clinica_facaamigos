import { GestorNav } from "@/components/gestor-nav";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { QuickActionsBar } from "@/components/quick-actions-bar";
import { StaffForm } from "./staff-form";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .order("full_name");

  return (
    <main className="flex flex-1 flex-col">
      <GestorNav active="cadastros" />
      <PageHeader
        axisLabel="Gestor"
        title="Equipe"
        description="Cadastro de contas — cada pessoa entra com o e-mail e a senha definidos aqui."
      />
      <div className="flex flex-col gap-6 p-6 sm:p-10">
        <StaffForm />
        <ul className="flex flex-col gap-2">
          {(staff ?? []).map((person) => (
            <li
              key={person.id}
              className="flex items-center justify-between rounded-md border border-paper-line-strong bg-paper/60 px-4 py-3 text-sm"
            >
              <span className="font-medium text-ink">{person.full_name}</span>
              <div className="flex items-center gap-4">
                <span className="text-ink-faint">
                  {ROLE_LABEL[person.role as Role]}
                  {!person.active && " — inativo"}
                </span>
                <QuickActionsBar
                  finance={{ href: "/faturamento/repasses", title: `Repasses de ${person.full_name}` }}
                  profile={{ href: "/gestor/equipe", title: `Perfil de ${person.full_name}` }}
                  edit={{ href: "/gestor/equipe", title: `Editar ${person.full_name}` }}
                  schedule={{ href: "/gestor/atendimentos", title: `Atendimentos de ${person.full_name}` }}
                />
              </div>
            </li>
          ))}
          {(staff ?? []).length === 0 && (
            <li className="text-sm text-ink-faint">Nenhuma conta cadastrada ainda.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
