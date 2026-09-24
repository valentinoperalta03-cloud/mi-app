import { test } from "node:test";
import assert from "node:assert/strict";
import { arMobileInputValue, arMobileProblem, formatArMobile, normalizeArMobile } from "../phone-ar";

const VALID: [string, string][] = [
  // CABA / AMBA (11)
  ["91122334455", "+5491122334455"],
  ["1122334455", "+5491122334455"],
  ["01122334455", "+5491122334455"],
  ["011 15 2233-4455", "+5491122334455"],
  ["11 15 2233 4455", "+5491122334455"],
  ["+54 9 11 2233-4455", "+5491122334455"],
  ["+54 11 2233 4455", "+5491122334455"],
  ["5491122334455", "+5491122334455"],
  // Córdoba (351)
  ["0351 15 555 1234", "+5493515551234"],
  ["351 555 1234", "+5493515551234"],
  ["93515551234", "+5493515551234"],
  // Mendoza (261)
  ["0261 15 444 5566", "+5492614445566"],
  ["2614445566", "+5492614445566"],
  // La Plata (221)
  ["0221 15 456 7890", "+5492214567890"],
  // Rosario (341)
  ["0341 15 678 9012", "+5493416789012"],
  ["3416789012", "+5493416789012"],
  // Tucumán (381)
  ["0381 15 432 1098", "+5493814321098"],
  // Bariloche (2944, área de 4 dígitos)
  ["02944 15 12 3456", "+5492944123456"],
  ["2944 15 123456", "+5492944123456"],
  ["2944123456", "+5492944123456"],
  ["+5492944123456", "+5492944123456"],
  // Mar del Plata (223)
  ["0223 15 512 3456", "+5492235123456"],
  // Prefijos duplicados o de marcación internacional
  ["54 54 9 11 2233 4455", "+5491122334455"],
  ["+54 +54 9 11 2233 4455", "+5491122334455"],
  ["+54 9 9 11 2233 4455", "+5491122334455"],
  ["549 9 11 2233 4455", "+5491122334455"],
  ["+54 0 11 2233 4455", "+5491122334455"],
  ["+54 011 15 2233 4455", "+5491122334455"],
  ["00 54 9 11 2233 4455", "+5491122334455"],
  ["(011) 15-2233-4455", "+5491122334455"],
];

for (const [input, expected] of VALID) {
  test(`normaliza ${JSON.stringify(input)} -> ${expected}`, () => {
    assert.equal(normalizeArMobile(input), expected);
  });
}

test("formatos equivalentes producen el mismo E.164", () => {
  const variants = ["91122334455", "011 15 2233-4455", "+54 11 2233 4455", "+5491122334455"];
  assert.equal(new Set(variants.map(normalizeArMobile)).size, 1);
});

test("no duplica +54 ni el 9", () => {
  const out = normalizeArMobile("+5491122334455");
  assert.equal(out, "+5491122334455");
  assert.ok(!out!.startsWith("+5454"));
  assert.ok(!out!.startsWith("+5499"));
});

const INVALID = [
  "", "123", "91122", "1522334455", "+1 415 555 2671", "+34 612 345 678", "abc", "0000000000", "91122334455999",
  // ficticios: 7 dígitos finales iguales
  "11 1111 1111", "+54 9 11 0000 0000", "341 000 0000",
  // demasiado cortos / largos
  "11 2233 445", "11 2233 44556", "011 15 15 2233 4455",
  // fijos (no móviles)
  "0800 222 1234",
];

for (const bad of INVALID) {
  test(`rechaza ${JSON.stringify(bad)}`, () => {
    assert.equal(normalizeArMobile(bad), null);
  });
}

test("no marca como ficticios números reales con dígitos repetidos", () => {
  assert.equal(normalizeArMobile("11 2222 3333"), "+5491122223333");
  assert.equal(normalizeArMobile("341 555 5551"), "+5493415555551");
});

test("arMobileProblem explica qué corregir", () => {
  assert.equal(arMobileProblem("11 2233 4455"), null);
  assert.match(arMobileProblem("")!, /Ingresá/);
  assert.match(arMobileProblem("11 2233 445")!, /Faltan dígitos/);
  assert.match(arMobileProblem("011 15 2233 445")!, /Faltan dígitos/);
  assert.match(arMobileProblem("11 2233 4455 667")!, /Sobran dígitos/);
  assert.match(arMobileProblem("15 2233 4455")!, /código de área antes del 15/);
  assert.match(arMobileProblem("+34 612 345 678")!, /Argentina/);
  assert.match(arMobileProblem("11 1111 1111")!, /no parece real/);
  assert.match(arMobileProblem("0800 222 1234")!, /celular argentino/);
});

test("corregir un dígito cambia el número normalizado", () => {
  assert.notEqual(normalizeArMobile("11 2233 4455"), normalizeArMobile("11 2233 4456"));
});

test("helpers de presentación", () => {
  assert.equal(arMobileInputValue("+5491122334455"), "91122334455");
  assert.equal(arMobileInputValue(null), "");
  assert.match(formatArMobile("+5491122334455"), /^\+54 9 11/);
});
