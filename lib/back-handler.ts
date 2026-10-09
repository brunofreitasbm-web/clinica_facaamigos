// Botão/gesto "voltar" do celular dentro de telas que trocam de subtela por
// estado (modais, gavetas, passos de um assistente). Motor sem React; o hook
// está em lib/use-back-handler.ts.
//
// Cada nível interno vira 1 entrada no histórico (pushState, mesma URL — o
// Next integra pushState ao router). Um único listener de popstate descobre
// qual entrada saiu e chama o onBack do dono dela (pilha global de donos). Com
// depth 0 nada é empilhado: "voltar" sai da página normalmente. Mudanças de
// rota feitas pelo Next não passam por aqui: se algo navegou por cima das
// nossas entradas, elas só são esquecidas (nunca usamos history.go além delas).
// Mesma lógica do useBackHandler do controle-de-estagiario e do BioFIT.

const MARK = "__backHandler";

type Owner = { getDepth: () => number; onBack: () => void };
type Entry = { id: string; owner: Owner | null };

let owners: Owner[] = [];
let entries: Entry[] = [];
let suppress = 0; // popstates causados por nós (history.go) que devem ser ignorados
let dirty = false;
let suppressTimer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
let listening = false;

const newId = () => `${Date.now()}-${++seq}`;
const ownedBy = (owner: Owner) => entries.filter((e) => e.owner === owner).length;
const markOf = (state: unknown): string | null => {
  const value = state && typeof state === "object" ? (state as Record<string, unknown>)[MARK] : null;
  return typeof value === "string" ? value : null;
};

function armSuppress() {
  suppress += 1;
  clearTimeout(suppressTimer);
  // Rede de segurança: se o navegador não emitir o popstate esperado, não travamos.
  suppressTimer = setTimeout(() => {
    suppress = 0;
    syncAll();
  }, 500);
}

function consumeSuppress() {
  suppress -= 1;
  if (suppress > 0) return;
  suppress = 0;
  clearTimeout(suppressTimer);
  if (dirty) syncAll();
}

function shrink(owner: Owner, n: number) {
  // Só desempilha com history.go(-k) se ainda estamos na nossa entrada do topo.
  const atTop = entries.length > 0 && markOf(window.history.state) === entries[entries.length - 1].id;
  let k = 0;
  while (k < n && entries[entries.length - 1 - k]?.owner === owner) k += 1;
  if (k > 0) entries.splice(entries.length - k, k);
  if (!atTop) k = 0;
  let rest = n - k;
  for (let i = entries.length - 1; i >= 0 && rest > 0; i -= 1) {
    if (entries[i].owner === owner) {
      entries[i].owner = null;
      rest -= 1;
    }
  }
  if (k > 0) {
    armSuppress();
    window.history.go(-k);
  }
}

export function syncAll() {
  if (suppress > 0) {
    dirty = true;
    return;
  }
  dirty = false;
  for (const owner of owners) {
    const depth = Math.max(0, owner.getDepth() | 0);
    const owned = ownedBy(owner);
    if (depth > owned) {
      for (let i = owned; i < depth; i += 1) {
        const id = newId();
        const base = window.history.state;
        // Preserva o state atual (o Next guarda nele o que precisa no popstate).
        const next = { ...(base && typeof base === "object" ? base : {}), [MARK]: id };
        window.history.pushState(next, "");
        entries.push({ id, owner });
      }
    } else if (depth < owned) {
      shrink(owner, owned - depth);
      if (suppress > 0) {
        dirty = true;
        return;
      }
    }
  }
}

function handlePopState(event: PopStateEvent) {
  if (suppress > 0) {
    consumeSuppress();
    return;
  }
  const dest = markOf(event.state);
  let popCount: number;
  if (dest === null) {
    popCount = entries.length;
  } else {
    const idx = entries.findIndex((e) => e.id === dest);
    if (idx < 0) {
      window.history.back(); // sobra de reload/"avançar": não há tela correspondente
      return;
    }
    popCount = entries.length - 1 - idx;
  }
  if (popCount === 0) return;
  const popped = entries.splice(entries.length - popCount, popCount);
  const handler = [...popped].reverse().find((e) => e.owner)?.owner;
  try {
    if (handler) handler.onBack();
    else if (dest !== null) window.history.back();
  } finally {
    // Se o onBack não reduziu o depth (ou lançou erro), ressincroniza depois que o React aplicar o setState.
    setTimeout(syncAll, 0);
  }
}

export function createBackOwner(opts: { getDepth: () => number; onBack: () => void }) {
  if (!listening) {
    window.addEventListener("popstate", handlePopState);
    listening = true;
  }
  const owner: Owner = { getDepth: opts.getDepth, onBack: opts.onBack };
  owners.push(owner);
  syncAll();
  return {
    sync: syncAll,
    destroy() {
      owner.getDepth = () => 0;
      syncAll();
      owners = owners.filter((o) => o !== owner);
    },
  };
}

/** Só para testes: zera o estado do módulo. */
export function resetBackHandlerForTests() {
  if (listening) window.removeEventListener("popstate", handlePopState);
  listening = false;
  owners = [];
  entries = [];
  suppress = 0;
  dirty = false;
  clearTimeout(suppressTimer);
}
