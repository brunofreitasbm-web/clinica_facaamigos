// app/recepcao/fila/undo-toast-pure.ts
// Máquina de estados do aviso com "Desfazer" da Fila de entrada. PURO, sem import com alias `@/`.
//
// Regras:
//   - cada ação mostra um aviso por N segundos (padrão 8) com o botão "Desfazer";
//   - uma ação nova substitui o aviso anterior (a anterior fica valendo);
//   - o aviso é amarrado ao caso (draftId) e ao próprio id: um "Desfazer" com outro caso ou de um
//     aviso já substituído é ignorado, então nunca desfaz o caso errado;
//   - passado o prazo, o "Desfazer" some e o pedido é ignorado.

export const UNDO_SECONDS = 8;

export type ToastPhase = "open" | "undoing" | "undone" | "error";

export type ToastState = {
  id: number;
  draftId: string;
  message: string;
  phase: ToastPhase;
  /** ms (Date.now) em que o aviso some. Enquanto desfaz, não expira. */
  expiresAt: number;
} | null;

export type ToastAction =
  | { type: "show"; id: number; draftId: string; message: string; now: number; seconds?: number }
  | { type: "tick"; now: number }
  | { type: "undo_start"; id: number; draftId: string; now: number }
  | { type: "undo_result"; id: number; ok: boolean; message: string; now: number; seconds?: number }
  | { type: "dismiss"; id: number };

const ms = (seconds: number | undefined) => (seconds ?? UNDO_SECONDS) * 1000;

/** O "Desfazer" deste aviso ainda pode ser usado para este caso agora? */
export function canUndo(state: ToastState, id: number, draftId: string, now: number): boolean {
  return Boolean(state && state.id === id && state.draftId === draftId && state.phase === "open" && now < state.expiresAt);
}

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "show":
      return { id: action.id, draftId: action.draftId, message: action.message, phase: "open", expiresAt: action.now + ms(action.seconds) };
    case "tick":
      if (!state || state.phase === "undoing") return state;
      return action.now >= state.expiresAt ? null : state;
    case "undo_start":
      return canUndo(state, action.id, action.draftId, action.now) && state ? { ...state, phase: "undoing" } : state;
    case "undo_result":
      if (!state || state.id !== action.id || state.phase !== "undoing") return state;
      return { ...state, phase: action.ok ? "undone" : "error", message: action.message, expiresAt: action.now + ms(action.seconds) };
    case "dismiss":
      return state && state.id === action.id ? null : state;
  }
}
