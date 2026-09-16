import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * A lista de pacientes (patient-list-client.tsx, 591 linhas) hoje carrega
 * TODOS os pacientes da clínica antes de pintar — sem loading.tsx próprio,
 * essa espera ficava sem feedback nenhum, herdando só o skeleton genérico
 * de app/recepcao/loading.tsx no primeiro clique no módulo, mas não numa
 * navegação direta pra /recepcao/pacientes.
 */
export default function PacientesLoading() {
  return <ModuleSkeleton fill={false} title="Carregando..." subtitle="Buscando pacientes da clínica" />;
}
