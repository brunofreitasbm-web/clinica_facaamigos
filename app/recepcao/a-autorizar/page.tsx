import { redirect } from "next/navigation";

/**
 * "Autorizações" foi absorvida pela Fila de entrada (robô do portal incluído).
 * Links antigos continuam funcionando: o ?item= segue para a mesma família na Fila.
 */
export default async function AAutorizarPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item } = await searchParams;
  redirect(item ? `/recepcao/fila?item=${encodeURIComponent(item)}` : "/recepcao/fila");
}
