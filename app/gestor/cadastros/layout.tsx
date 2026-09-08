import { GestorNav } from "@/components/gestor-nav";

export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col">
      <GestorNav active="cadastros" />
      <div className="flex flex-1">{children}</div>
    </main>
  );
}
