import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatWhatsapp,
  normalizeClubName,
  normalizeWhatsapp,
  validateClubLead,
  whatsappHref,
} from "../club-leads";

function ok(dial: string, raw: string): string {
  const r = normalizeWhatsapp(dial, raw);
  assert.ok(r.ok, `esperaba válido: ${dial} ${raw} -> ${!r.ok ? r.error : ""}`);
  return r.value;
}

test("Argentina: agrega el 9 y quita 0 y 15", () => {
  assert.equal(ok("54", "11 2345 6789"), "+5491123456789");
  assert.equal(ok("54", "011 15 2345-6789"), "+5491123456789");
  assert.equal(ok("54", "351 15 612 3456"), "+5493516123456");
  assert.equal(ok("54", "0351 612-3456"), "+5493516123456");
  assert.equal(ok("54", "2972 15 41 2345"), "+5492972412345");
  assert.equal(ok("", "+54 9 11 2345 6789"), "+5491123456789");
  assert.equal(ok("", "+54 11 2345 6789"), "+5491123456789");
  assert.equal(ok("", "0054 9 11 2345 6789"), "+5491123456789");
  assert.equal(ok("UY-ignorado", "+5491123456789"), "+5491123456789");
});

test("Argentina: rechaza números incompletos", () => {
  assert.equal(normalizeWhatsapp("54", "2345 6789").ok, false);
  assert.equal(normalizeWhatsapp("54", "11 2345 678").ok, false);
});

test("otros países", () => {
  assert.equal(ok("598", "099 123 456"), "+59899123456");
  assert.equal(ok("34", "612 34 56 78"), "+34612345678");
  assert.equal(ok("1", "(305) 555-0123"), "+13055550123");
  assert.equal(ok("", "+56 9 1234 5678"), "+56912345678");
});

test("entradas malformadas", () => {
  assert.equal(normalizeWhatsapp("54", "").ok, false);
  assert.equal(normalizeWhatsapp("54", "abc123").ok, false);
  assert.equal(normalizeWhatsapp("54", "1".repeat(40)).ok, false);
  assert.equal(normalizeWhatsapp("999", "11 2345 6789").ok, false);
  assert.equal(normalizeWhatsapp("", "11 2345 6789").ok, false);
  assert.equal(normalizeWhatsapp("54", 12345 as unknown).ok, false);
  assert.equal(normalizeWhatsapp("", "+0 123 4567 89").ok, false);
});

test("nombre del club", () => {
  assert.deepEqual(normalizeClubName("  Padel   Norte \n"), { ok: true, value: "Padel Norte" });
  assert.equal(normalizeClubName("").ok, false);
  assert.equal(normalizeClubName("x").ok, false);
  assert.equal(normalizeClubName("a".repeat(121)).ok, false);
  assert.equal(normalizeClubName("Visitá https://spam.com").ok, false);
  assert.equal(normalizeClubName({}).ok, false);
});

test("validateClubLead", () => {
  const good = validateClubLead({ clubName: "Club X", dial: "54", phone: "11 2345 6789", problem: "torneos" });
  assert.ok(good.ok);
  assert.equal(good.ok && good.value.whatsapp, "+5491123456789");
  const bad = validateClubLead({ clubName: "", dial: "54", phone: "1", problem: "hackear" });
  assert.ok(!bad.ok);
  assert.deepEqual(Object.keys(!bad.ok ? bad.errors : {}).sort(), ["clubName", "phone", "problem"]);
});

test("links y formato", () => {
  assert.equal(whatsappHref("+5491123456789"), "https://wa.me/5491123456789");
  assert.equal(whatsappHref("+5491123456789", "Hola Club"), "https://wa.me/5491123456789?text=Hola%20Club");
  assert.equal(formatWhatsapp("+5491123456789"), "+54 9 11 2345 6789");
  assert.equal(formatWhatsapp("+5493516123456"), "+54 9 351 612 3456");
  assert.equal(formatWhatsapp("+34612345678"), "+34612345678");
});
