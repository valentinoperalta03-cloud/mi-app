// Llamadas directas a completarPerfilAction (sin pasar por la UI), con
// Supabase y Next mockeados. Correr con `npm run test:phone`.
import { mock, test } from "node:test";
import assert from "node:assert/strict";

type RpcCall = { fn: string; args: Record<string, unknown> };
const state = {
  user: { id: "u1" } as { id: string } | null,
  onboardingCompleted: false,
  rpcCalls: [] as RpcCall[],
  rpcError: null as { message: string; code?: string } | null,
  updateCalls: 0,
};

const fakeClient = {
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { onboarding_completed: state.onboardingCompleted } }) }),
    }),
    update: () => {
      state.updateCalls++;
      return { eq: async () => ({ error: null }) };
    },
  }),
  rpc: async (fn: string, args: Record<string, unknown>) => {
    state.rpcCalls.push({ fn, args });
    return { error: state.rpcError };
  },
};

class Redirect extends Error {
  url: string;
  constructor(url: string) {
    super("NEXT_REDIRECT");
    this.url = url;
  }
}

mock.module("@/utils/supabase/server", { namedExports: { createClient: async () => fakeClient } });
mock.module("@/lib/profiles", { namedExports: { ensureProfileRowExists: async () => ({ error: null }) } });
mock.module("next/cache.js", { namedExports: { revalidatePath: () => {} } });
mock.module("next/navigation.js", {
  namedExports: {
    redirect: (url: string) => {
      throw new Redirect(url);
    },
  },
});

const { completarPerfilAction } = await import("../actions");

const VALID = {
  name: "Ana",
  age: 30,
  gender: "femenino" as const,
  preferredHand: "derecha" as const,
  courtPosition: "drive" as const,
  preferredSchedule: "noche" as const,
  category: "6ta",
  phone: "0341 15 678 9012",
  phoneConfirmed: true,
  province: "Santa Fe",
  city: "Rosario",
};

function reset() {
  state.user = { id: "u1" };
  state.onboardingCompleted = false;
  state.rpcCalls = [];
  state.rpcError = null;
  state.updateCalls = 0;
}

test("número inválido: rechaza con qué corregir y no llama a la RPC", async () => {
  reset();
  const res = await completarPerfilAction({ ...VALID, phone: "11 2233 445" });
  assert.equal(res.ok, false);
  assert.match(res.message, /Faltan dígitos/);
  assert.equal(state.rpcCalls.length, 0);
});

test("sin confirmación explícita: rechaza", async () => {
  reset();
  for (const phoneConfirmed of [false, undefined, "true"]) {
    const res = await completarPerfilAction({ ...VALID, phoneConfirmed: phoneConfirmed as boolean });
    assert.equal(res.ok, false);
    assert.match(res.message, /Confirmá/);
  }
  assert.equal(state.rpcCalls.length, 0);
});

test("sin sesión: rechaza", async () => {
  reset();
  state.user = null;
  const res = await completarPerfilAction(VALID);
  assert.equal(res.ok, false);
  assert.equal(state.rpcCalls.length, 0);
});

test("finalización legítima sin OTP: RPC con teléfono E.164 normalizado", async () => {
  reset();
  await assert.rejects(completarPerfilAction(VALID), (e: unknown) => e instanceof Redirect && e.url === "/home");
  assert.equal(state.rpcCalls.length, 1);
  const { fn, args } = state.rpcCalls[0];
  assert.equal(fn, "complete_player_onboarding");
  assert.equal(args.p_phone, "+5493416789012");
  // Nunca escribe profiles directo ni manda onboarding_completed desde el cliente.
  assert.equal(state.updateCalls, 0);
  assert.ok(!("onboarding_completed" in args));
});

test("perfil ya completo: no vuelve a llamar a la RPC", async () => {
  reset();
  state.onboardingCompleted = true;
  const res = await completarPerfilAction(VALID);
  assert.deepEqual(res, { ok: false, message: "Ya completaste tu perfil." });
  assert.equal(state.rpcCalls.length, 0);
});

test("la RPC rechaza el teléfono: mensaje claro", async () => {
  reset();
  state.rpcError = { message: "invalid_phone" };
  const res = await completarPerfilAction(VALID);
  assert.deepEqual(res, { ok: false, message: "Revisá el número que ingresaste." });
});
