// tests/backfill-whatsapp-leads.test.ts
//
// Lógica pura do backfill de leads de WhatsApp
// (scripts/backfill-whatsapp-leads-pure.ts): nome dos objetos legados,
// URL pública → caminho de objeto, ponteiro `storage://`, CPF mascarado e args.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  legacySlotsFromRecord,
  legacySourceKey,
  legacyUrlToPath,
  maskCpf,
  normalizeBrLocalPhone,
  parseArgs,
  parseLegacyObjectName,
  parseStoragePointer,
  toStoragePointer,
} from "../scripts/backfill-whatsapp-leads-pure.ts";

const BASE = "https://vththexblpxwocbowhsv.supabase.co/storage/v1/object/public/patient-documents";

test("parseLegacyObjectName: epoch, tipo e telefone do nome do objeto", () => {
  assert.deepEqual(parseLegacyObjectName("anamnese-laudos-guias/1789569126501_laudo_+559189371732.pdf"), {
    path: "anamnese-laudos-guias/1789569126501_laudo_+559189371732.pdf",
    epochMs: 1789569126501,
    slot: "laudo",
    kind: "laudo",
    phone: "+559189371732",
    ext: "pdf",
  });
  const guia = parseLegacyObjectName("anamnese-laudos-guias/1789914158378_guia_+559192488884.pdf");
  assert.equal(guia?.kind, "guia");
  assert.equal(guia?.phone, "+559192488884");
});

test("parseLegacyObjectName: carteirinha frente/verso viram kind carteirinha (slot preservado)", () => {
  const frente = parseLegacyObjectName("anamnese-laudos-guias/1789000000000_carteirinha_frente_+559111111111.jpg");
  assert.equal(frente?.kind, "carteirinha");
  assert.equal(frente?.slot, "carteirinha_frente");
  assert.equal(frente?.ext, "jpg");
  assert.equal(parseLegacyObjectName("x/1789000000000_carteirinha_verso_+559111111111.pdf")?.slot, "carteirinha_verso");
});

test("parseLegacyObjectName: nome fora do padrão vira null", () => {
  assert.equal(parseLegacyObjectName("anamnese-laudos-guias/foto.pdf"), null);
  assert.equal(parseLegacyObjectName("anamnese-laudos-guias/1789_laudo_+559189371732.pdf"), null); // epoch curto
  assert.equal(parseLegacyObjectName("anamnese-laudos-guias/1789569126501_outro_+559189371732.pdf"), null);
  assert.equal(parseLegacyObjectName("anamnese-laudos-guias/1789569126501_laudo_+55.pdf"), null);
});

test("legacyUrlToPath: URL pública do bucket legado → caminho do objeto", () => {
  assert.equal(
    legacyUrlToPath(`${BASE}/anamnese-laudos-guias/1789569126501_laudo_+559189371732.pdf`),
    "anamnese-laudos-guias/1789569126501_laudo_+559189371732.pdf",
  );
  // %2B e espaços codificados; "+" cru no path NÃO vira espaço.
  assert.equal(legacyUrlToPath(`${BASE}/anamnese-laudos-guias/1_laudo_%2B5591.pdf`), "anamnese-laudos-guias/1_laudo_+5591.pdf");
  assert.equal(legacyUrlToPath(`${BASE}/a/b%20c.pdf?token=1#x`), "a/b c.pdf");
});

test("legacyUrlToPath: null para ponteiro migrado, outro bucket, Twilio, lixo e path traversal", () => {
  assert.equal(legacyUrlToPath("storage://clinic-documents/leads/5591/1-laudo-abc.pdf"), null);
  assert.equal(legacyUrlToPath("https://x.supabase.co/storage/v1/object/public/clinic-documents/a.pdf"), null);
  assert.equal(legacyUrlToPath("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1"), null);
  assert.equal(legacyUrlToPath("não é url"), null);
  assert.equal(legacyUrlToPath(""), null);
  assert.equal(legacyUrlToPath(null), null);
  assert.equal(legacyUrlToPath(`${BASE}/`), null);
  // O parser de URL colapsa ".." (inclusive %2e%2e) antes de chegar aqui: ou fica dentro do bucket…
  assert.equal(legacyUrlToPath(`${BASE}/a/../b.pdf`), "b.pdf");
  assert.equal(legacyUrlToPath(`${BASE}/a/%2e%2e/b.pdf`), "b.pdf");
  // …ou escapa do prefixo do bucket legado e é recusado.
  assert.equal(legacyUrlToPath(`${BASE}/../../x.pdf`), null);
  assert.equal(legacyUrlToPath(`${BASE}/a/%E0%A4%A.pdf`), null); // percent-encoding inválido
});

test("toStoragePointer / parseStoragePointer: ida e volta no formato lido por lib/file-access.ts", () => {
  const pointer = toStoragePointer("leads/559189371732/1789-laudo-abc123.pdf");
  assert.equal(pointer, "storage://clinic-documents/leads/559189371732/1789-laudo-abc123.pdf");
  assert.deepEqual(parseStoragePointer(pointer), { bucket: "clinic-documents", path: "leads/559189371732/1789-laudo-abc123.pdf" });
  assert.equal(toStoragePointer("/leads/x.pdf"), "storage://clinic-documents/leads/x.pdf");
  assert.equal(parseStoragePointer("https://x/y"), null);
  assert.equal(parseStoragePointer(null), null);
});

test("legacySourceKey: chave estável por objeto", () => {
  assert.equal(legacySourceKey("anamnese-laudos-guias/1_laudo_+55.pdf"), "legacy:anamnese-laudos-guias/1_laudo_+55.pdf");
});

test("legacySlotsFromRecord: só slots que ainda apontam para o bucket legado (idempotência)", () => {
  const slots = legacySlotsFromRecord({
    child_name: "Samuel",
    laudo_pdf_url: `${BASE}/anamnese-laudos-guias/1_laudo_+5591.pdf`,
    guia_pdf_url: "storage://clinic-documents/leads/5591/2-guia-x.pdf", // já migrado
    carteirinha_frente_url: "https://api.twilio.com/media/1", // Twilio cru
    carteirinha_verso_url: 42,
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].key, "laudo_pdf_url");
  assert.equal(slots[0].kind, "laudo");
  assert.equal(slots[0].path, "anamnese-laudos-guias/1_laudo_+5591.pdf");
  assert.deepEqual(legacySlotsFromRecord(null), []);
});

test("maskCpf nunca devolve o CPF completo", () => {
  assert.equal(maskCpf("123.456.789-09"), "***.***.***-09");
  assert.equal(maskCpf("12345678909"), "***.***.***-09");
  assert.equal(maskCpf(null), null);
  assert.equal(maskCpf("1"), "***");
  assert.ok(!maskCpf("12345678909")!.includes("456"));
});

test("normalizeBrLocalPhone: ignora DDI e o 9 opcional do celular", () => {
  assert.equal(normalizeBrLocalPhone("+559189371732"), "9189371732");
  assert.equal(normalizeBrLocalPhone("(91) 8937-1732"), "9189371732");
  assert.equal(normalizeBrLocalPhone("+55 91 9 8937-1732"), normalizeBrLocalPhone("(91) 8937-1732"));
});

test("parseArgs: dry-run é o padrão; --apply liga a escrita; --dry-run vence --apply", () => {
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs(["--apply"]).apply, true);
  assert.equal(parseArgs(["--apply", "--dry-run"]).apply, false);
  const opts = parseArgs(["--apply", "--skip-drafts", "--enrich", "--include-extracted-drafts"]);
  assert.equal(opts.skipDrafts && opts.enrich && opts.includeExtractedDrafts, true);
  assert.deepEqual(parseArgs(["--aplly"]).unknown, ["--aplly"]);
});
