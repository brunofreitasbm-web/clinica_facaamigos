// app/recepcao/pacientes/pendencias/open-whatsapp.ts
//
// Abre o WhatsApp (wa.me) depois de uma server action. O navegador só deixa
// `window.open` abrir aba quando é chamado dentro do clique: depois de um
// `await` o Safari/iOS (e às vezes o Chrome) bloqueia como pop-up. Por isso a
// aba é aberta em branco NO clique e só recebe o endereço quando a action
// responde.

/** Chamar de forma síncrona no handler do clique/submit, antes de qualquer await. */
export function preOpenWhatsappWindow(): Window | null {
  try {
    return window.open("about:blank", "_blank");
  } catch {
    return null;
  }
}

/**
 * Aponta a aba pré-aberta para o link, ou a fecha quando não há link (erro ou
 * responsável sem telefone). `true` = o WhatsApp abriu; `false` com link =
 * pop-up bloqueado, e quem chamou mostra o link para a recepção clicar.
 */
export function finishWhatsappWindow(win: Window | null, url: string | undefined): boolean {
  if (!url) {
    win?.close();
    return false;
  }
  if (!win || win.closed) return false;
  win.opener = null;
  win.location.href = url;
  return true;
}
