import NovoPlanoPage from "@/app/supervisao/planos/novo/page";

// Rota do terapeuta com acesso ao PTS (profiles.can_create_pts). O middleware
// já libera /terapeuta; a checagem da flag fica na página compartilhada.
export const dynamic = "force-dynamic";

export default NovoPlanoPage;
