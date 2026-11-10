"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { AGENT_NAME_MAX } from "@/lib/portal-robot-pure";
import { createRobotAgent, setRobotAgentActive } from "./actions";

export type RobotAgentView = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  version: string | null;
  online: boolean;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string | null): string {
  if (!iso) return "nunca";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? dateTime.format(t) : "—";
}

export function RoboPortalManager({ agents }: { agents: RobotAgentView[] }) {
  const router = useRouter();
  const [name, setName] = useState("Computador da recepção");
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createRobotAgent(name);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCreated({ name: result.name, token: result.token });
      router.refresh();
    });
  }

  function toggleActive(agent: RobotAgentView) {
    if (agent.active && !window.confirm(`Desativar "${agent.name}"? O robô desse computador para de funcionar na hora.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setRobotAgentActive(agent.id, !agent.active);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  async function copyToken() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`AGENT_TOKEN=${created.token}`);
      setCopied(true);
    } catch {
      setError("Não deu para copiar automaticamente. Selecione o texto e copie com Ctrl+C.");
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">Cadastrar um computador</h2>
        <p className="text-sm text-ink-soft">
          Cada computador que roda o robô precisa de uma chave própria. Um só computador ligado já atende a clínica
          toda — a recepção usa o robô de qualquer lugar pelo CRM.
        </p>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm text-ink">
            Nome do computador
            <input
              className="input"
              value={name}
              maxLength={AGENT_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Computador da recepção"
            />
          </label>
          <button type="submit" disabled={isPending} className="btn btn-primary w-fit">
            {isPending ? "Cadastrando…" : "Cadastrar robô"}
          </button>
        </form>
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      </section>

      {created && (
        <section className="flex flex-col gap-3 rounded-md border-2 border-amber-400 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-ink">Chave do &quot;{created.name}&quot;</h2>
          <p className="text-sm text-ink">
            Copie a linha abaixo e cole no arquivo <code>.env</code> da pasta <code>agente-robo</code> desse
            computador, no lugar da linha <code>AGENT_TOKEN=</code>. <strong>Ela só aparece agora</strong> — se
            perder, é só cadastrar de novo e desativar o antigo.
          </p>
          <code className="block select-all rounded border border-paper-line-strong bg-white p-3 text-xs text-ink [overflow-wrap:anywhere]">
            AGENT_TOKEN={created.token}
          </code>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={copyToken} className="btn btn-primary flex w-fit items-center gap-2">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button type="button" onClick={() => setCreated(null)} className="btn btn-secondary w-fit">
              Já colei no .env
            </button>
          </div>
          <p className="text-xs text-ink-soft">
            Depois, abra o robô nesse computador. Em poucos segundos ele aparece como &quot;ligado&quot; na lista abaixo.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">Computadores cadastrados</h2>
        {agents.length === 0 ? (
          <p className="text-sm text-ink-soft">Nenhum computador cadastrado ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-paper-line-strong rounded-md border border-paper-line-strong">
            {agents.map((agent) => (
              <li key={agent.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={`text-sm font-semibold ${agent.active ? "text-ink" : "text-ink-soft line-through"}`}>
                    {agent.name}
                  </span>
                  <span className="text-xs text-ink-soft">
                    {!agent.active ? (
                      "Desativado"
                    ) : agent.online ? (
                      <span className="font-semibold text-emerald-700">● Ligado agora</span>
                    ) : (
                      <>○ Desligado · último sinal: {formatWhen(agent.lastSeenAt)}</>
                    )}
                    {agent.version ? ` · versão ${agent.version}` : ""}
                    {` · cadastrado em ${formatWhen(agent.createdAt)}`}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => toggleActive(agent)}
                  className="btn btn-secondary w-fit"
                >
                  {agent.active ? "Desativar" : "Reativar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
