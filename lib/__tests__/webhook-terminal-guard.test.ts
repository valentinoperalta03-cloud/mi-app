import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Tripwire estático para lib/mp-handlers/payment-webhook-handler.ts (mismo
 * criterio que los demás archivos en __tests__: no hay DB real ni mock de
 * Next.js Request/Response en el repo). Cubre lo que refund-terminal-state.test.ts
 * NO puede cubrir porque vive en un route handler: que el helper que
 * realmente bloquea la escritura ante una transición ilegal esté cableado en
 * los 3 puntos del bug reportado, y que ya no queden los try/catch mudos que
 * dejaban pasar el UPDATE igual.
 */

const WEBHOOK_PATH = "lib/mp-handlers/payment-webhook-handler.ts";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf-8");
}

describe("payment-webhook-handler: transiciones ilegales abortan el UPDATE, no solo se loguean", () => {
  const source = readRepoFile(WEBHOOK_PATH);

  it("importa IllegalTransitionError", () => {
    assert.match(source, /import \{ IllegalTransitionError \} from "@\/lib\/state-machines\/errors"/);
  });

  it("define attemptTransitions: solo IllegalTransitionError se traga, cualquier otro error se relanza", () => {
    const start = source.indexOf("function attemptTransitions(");
    assert.notEqual(start, -1, "falta el helper attemptTransitions");
    const body = source.slice(start, start + 400);
    assert.match(body, /err instanceof IllegalTransitionError/);
    assert.match(body, /throw err/);
  });

  it("ya no queda ningún catch mudo (`catch {` / `catch \\{\\}`) alrededor de los asserts de state-machine", () => {
    // Antes del fix había 3 ocurrencias de "catch {" seguidas de un comentario
    // tipo "/* logged */" que tragaban IllegalTransitionError sin frenar nada.
    // El único catch legítimo que queda es el de webhook.refunded_reserva,
    // que ahora re-lanza explícitamente lo que no sea IllegalTransitionError
    // (`catch (err) {`), no un `catch {` mudo.
    assert.doesNotMatch(source, /catch \{\s*\/\* logging ya en asserts \*\//);
    assert.doesNotMatch(source, /catch \{\s*\/\* logged \*\//);
  });

  it("webhook.approved_match: valida la transición del payment row (no solo del match) antes de resucitar approved", () => {
    const idx = source.indexOf('trigger: "webhook.approved_match"');
    assert.notEqual(idx, -1);
    // Debe existir un assertPaymentRowTransition(..., "approved", ...) ANTES
    // del UPDATE de payments.status = "approved" — es el chequeo que faltaba
    // por completo (el bug real: nunca se validaba la fila de payments).
    assert.match(source, /assertPaymentRowTransition\(existingPay\?\.status, "approved"/);
  });

  it("webhook.approved_match: el branch aborta con return temprano cuando la transición es ilegal", () => {
    assert.match(source, /paymentRowTransitionAllowed/);
    assert.match(source, /matchTransitionAllowed/);
    assert.match(source, /mp\.webhook\.match\.terminal_payment_skip/);
    assert.match(source, /mp\.webhook\.match\.terminal_match_skip/);
  });

  it("webhook.reject_reserva: también aborta ante transición ilegal (defensa en profundidad)", () => {
    assert.match(source, /rejectPaymentRowAllowed/);
    assert.match(source, /rejectMatchAllowed/);
  });

  it("el bloque 'hold_lost' (approved sobre un hold vencido) sigue registrando el dinero sin re-confirmar la cancha", () => {
    // Objetivo 5: NO tocar este comportamiento — el dinero recibido sin
    // reembolso sigue siendo auditable.
    assert.match(source, /mp\.webhook\.approved_after_hold_lost/);
    assert.match(source, /No se re-confirmó la reserva/);
  });
});
