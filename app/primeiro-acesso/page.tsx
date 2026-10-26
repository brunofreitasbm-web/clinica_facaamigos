import { redirect } from "next/navigation";

export default function PrimeiroAcessoRedirect() {
  redirect("/login?mode=recovery");
}
