"use client";

import { useRef, useState, useTransition } from "react";
import { uploadPatientPhoto } from "./actions";

/**
 * "Mural da Família" — card persuasivo convidando o responsável a enviar uma
 * foto atual da criança. Objetivo duplo (PRD): compor o mural físico da
 * recepção e ajudar a equipe a reconhecer a criança presencialmente. Mesmo
 * padrão de dialog/upload de UploadDocument (./upload-document.tsx), mas
 * como card de destaque em vez de botão discreto — a foto é opcional e
 * espontânea, então o convite precisa vender o benefício, não só oferecer o
 * botão.
 */
export function PatientPhotoUpload({
  patientId,
  firstName,
  currentPhotoUrl,
}: {
  patientId: string;
  firstName: string;
  currentPhotoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function close() {
    setOpen(false);
    setError(null);
    setSent(false);
    setPreview(null);
    formRef.current?.reset();
  }

  return (
    <>
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          background: "linear-gradient(135deg, var(--color-accent-100) 0%, var(--color-surface) 70%)",
          border: "1px solid var(--color-accent-300)",
          padding: "18px 18px 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            flexShrink: 0,
            overflow: "hidden",
            border: "2px solid var(--color-surface)",
            boxShadow: "var(--shadow-sm)",
            background: "var(--color-accent-200)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
          }}
        >
          {currentPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentPhotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            "🖼️"
          )}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15 }}>
            {currentPhotoUrl ? "Foto no mural ✓" : "Coloque a fotinho de " + firstName + " no nosso mural! 💛"}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--color-neutral-700)", margin: "4px 0 10px", lineHeight: 1.45 }}>
            {currentPhotoUrl
              ? "Quer trocar por uma foto mais recente? É rapidinho."
              : "Assim toda a equipe reconhece na hora quem é quem quando vocês chegam — e a foto ainda ganha um cantinho especial no mural da recepção. Leva menos de 1 minuto!"}
          </p>
          <button type="button" className="btn btn-gold" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>
            {currentPhotoUrl ? "📷 Trocar foto" : "📷 Enviar foto agora"}
          </button>
        </div>
      </div>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title flex items-center justify-between">
              <span>Foto de {firstName} para o mural</span>
            </div>

            {sent ? (
              <>
                <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 mb-4 text-emerald-900 text-sm">
                  <p className="font-semibold mb-1">✓ Foto enviada!</p>
                  <p className="text-xs text-emerald-800">
                    Obrigado por participar do mural — em breve ela estará por lá, e a equipe já poderá usá-la
                    para reconhecer {firstName} na clínica.
                  </p>
                </div>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-primary" onClick={close}>
                    Entendido
                  </button>
                </div>
              </>
            ) : (
              <form
                ref={formRef}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const file = formData.get("photo");
                  if (!(file instanceof File) || file.size === 0) {
                    setError("Selecione uma foto.");
                    return;
                  }
                  setError(null);
                  startTransition(async () => {
                    const result = await uploadPatientPhoto(patientId, formData);
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    setSent(true);
                  });
                }}
              >
                <p className="text-xs text-ink-soft">
                  Escolha uma foto de rosto bem visível, tirada com boa luz — é ela que vai ajudar a
                  recepção e a equipe a identificar {firstName} rapidinho quando vocês chegarem, além de
                  aparecer no mural de fotos da clínica.
                </p>

                <div className="field">
                  <div
                    className="relative border border-dashed border-gray-300 rounded-md p-3 text-center bg-gray-50 hover:bg-gray-100 transition-colors"
                    style={{ minHeight: preview ? 160 : undefined }}
                  >
                    <input
                      type="file"
                      name="photo"
                      required
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      disabled={isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPreview(URL.createObjectURL(file));
                        } else {
                          setPreview(null);
                        }
                      }}
                    />
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt="Prévia da foto selecionada"
                        style={{ maxHeight: 140, borderRadius: "var(--radius-md)", margin: "0 auto" }}
                      />
                    ) : (
                      <span className="text-xs text-gray-600 block">📷 Clique para escolher uma foto (JPG, PNG)</span>
                    )}
                  </div>
                </div>

                {error && <p style={{ fontSize: 12, color: "var(--status-falta)" }}>{error}</p>}

                <div className="dialog-actions pt-2 border-t border-gray-100">
                  <button type="button" className="btn btn-secondary" onClick={close} disabled={isPending}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-gold" disabled={isPending}>
                    {isPending ? "Enviando..." : "Enviar foto"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
