import { GestorNav } from "@/components/gestor-nav";

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col">
      <GestorNav active="configuracoes" />
      <div className="flex flex-1">{children}</div>
    </main>
  );
}
