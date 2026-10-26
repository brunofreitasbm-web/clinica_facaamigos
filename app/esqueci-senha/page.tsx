import { redirect } from "next/navigation";

export default function EsqueciSenhaRedirect() {
  redirect("/login?mode=recovery");
}
