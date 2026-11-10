// tests/messages-insert-pure.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isMissingSentByColumn, withoutSentBy } from "../lib/messages-insert-pure.ts";

test("coluna sent_by inexistente (Postgres e PostgREST) é reconhecida", () => {
  assert.equal(isMissingSentByColumn({ code: "42703", message: 'column "sent_by" of relation "messages" does not exist' }), true);
  assert.equal(isMissingSentByColumn({ code: "PGRST204", message: "Could not find the 'sent_by' column of 'messages' in the schema cache" }), true);
});

test("outros erros NÃO são engolidos", () => {
  assert.equal(isMissingSentByColumn(null), false);
  assert.equal(isMissingSentByColumn(undefined), false);
  assert.equal(isMissingSentByColumn({ code: "23505", message: "duplicate key value violates unique constraint idx_messages_twilio_sid" }), false);
  assert.equal(isMissingSentByColumn({ code: "42703", message: 'column "intent" does not exist' }), false);
  assert.equal(isMissingSentByColumn({ code: "23503", message: "insert or update on table messages violates foreign key constraint messages_sent_by_fkey" }), false);
});

test("withoutSentBy remove só a coluna sent_by", () => {
  const row = { body: "oi", sent_by: "u1", direction: "outbound" };
  assert.deepEqual(withoutSentBy(row), { body: "oi", direction: "outbound" });
  assert.equal("sent_by" in row, true, "não muta o original");
});
