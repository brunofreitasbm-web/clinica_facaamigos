"use client";

import { useRef, useState, useTransition } from "react";
import { createFeedPost } from "./feed-actions";
import { compressImageIfNeeded } from "@/lib/compress-image";

export function FeedPostForm({ patientId }: { patientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setNotice(null);

        const form = e.currentTarget;
        const body = String(new FormData(form).get("body") ?? "");
        const fileInput = form.elements.namedItem("files") as HTMLInputElement | null;
        const files = fileInput?.files ? Array.from(fileInput.files) : [];

        (async () => {
          setIsCompressing(true);
          const compressed = await Promise.all(files.map((f) => compressImageIfNeeded(f)));
          setIsCompressing(false);

          const submitData = new FormData();
          submitData.set("body", body);
          for (const f of compressed) submitData.append("files", f);

          startTransition(async () => {
            const result = await createFeedPost(patientId, submitData);
            if (!result.success) {
              setError(result.error);
              return;
            }
            if (result.failedUploads > 0) {
              setNotice(`Publicado, mas ${result.failedUploads} foto(s) não puderam ser enviadas.`);
            }
            formRef.current?.reset();
          });
        })();
      }}
    >
      <textarea
        name="body"
        rows={3}
        placeholder="Escreva um recado para a família…"
        className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
      />
      <input
        type="file"
        name="files"
        multiple
        accept="image/*"
        className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
      />
      <div>
        <button
          type="submit"
          disabled={isPending || isCompressing}
          className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isCompressing ? "Preparando fotos…" : isPending ? "Publicando…" : "Publicar no mural"}
        </button>
      </div>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
      {notice && <p className="text-xs text-status-pending-text">{notice}</p>}
    </form>
  );
}
