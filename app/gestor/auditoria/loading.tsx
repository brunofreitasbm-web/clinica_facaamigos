import { GestorNav } from "@/components/gestor-nav";
import { ModuleSkeleton } from "@/components/module-skeleton";

export default function AuditoriaLoading() {
  return (
    <>
      <GestorNav active="auditoria" />
      <ModuleSkeleton title="Auditoria & LGPD" subtitle="Carregando registros de acessos e logs do sistema" />
    </>
  );
}
