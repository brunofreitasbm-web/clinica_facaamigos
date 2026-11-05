import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isParticularSaleAlert,
  applyConversationChange,
  type ParticularAlertConversation,
} from "../lib/atendimento/particular-alert-pure.ts";

const base = { id: "c1", status: "pending", escalationReason: "particular_agendar", assignedTo: null, patientId: null };

test("só particular_agendar pendente, sem dono e sem paciente dispara o alerta", () => {
  assert.equal(isParticularSaleAlert(base), true);
  assert.equal(isParticularSaleAlert({ ...base, escalationReason: "pediu_humano" }), false);
  assert.equal(isParticularSaleAlert({ ...base, escalationReason: "particular" }), false);
  assert.equal(isParticularSaleAlert({ ...base, assignedTo: "u1" }), false);
  assert.equal(isParticularSaleAlert({ ...base, status: "open" }), false);
  assert.equal(isParticularSaleAlert({ ...base, patientId: "p1" }), false);
});

test("evento realtime adiciona a conversa à lista do alerta, sem duplicar", () => {
  const one = applyConversationChange([], { ...base, contactName: "Maria", phoneNumber: "+5591" });
  assert.equal(one.length, 1);
  const again = applyConversationChange(one, { ...base, contactName: "Maria", phoneNumber: "+5591" });
  assert.equal(again.length, 1);
});

test("quando alguém assume, marca como particular ou encerra, a conversa sai da lista", () => {
  const list: ParticularAlertConversation[] = [{ ...base, contactName: null, phoneNumber: "+5591" }];
  assert.equal(applyConversationChange(list, { ...base, assignedTo: "u1", contactName: null, phoneNumber: "+5591" }).length, 0);
  assert.equal(applyConversationChange(list, { ...base, escalationReason: null, contactName: null, phoneNumber: "+5591" }).length, 0);
  assert.equal(applyConversationChange(list, { ...base, status: "closed", contactName: null, phoneNumber: "+5591" }).length, 0);
});

test("evento de conversa que nunca foi alerta não altera a lista", () => {
  const list: ParticularAlertConversation[] = [];
  assert.equal(applyConversationChange(list, { ...base, escalationReason: "clinico", contactName: null, phoneNumber: "x" }).length, 0);
});
