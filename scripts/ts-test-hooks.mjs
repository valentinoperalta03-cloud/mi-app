// Permite correr tests .ts con `node --test` (type stripping nativo de Node)
// resolviendo imports relativos sin extensión, igual que el bundler de Next.
// También resuelve el alias "@/..." (tsconfig `"@/*": ["./*"]`) contra la
// raíz del proyecto, para poder importar directamente módulos de lib/ que
// usan ese alias internamente (ej. lib/payment-refund.ts, lib/state-machines/*)
// sin tener que reescribirlos a imports relativos solo para poder testearlos.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    const isAlias = specifier.startsWith("@/");
    if ((isRelative || isAlias) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const base = isAlias ? PROJECT_ROOT : context.parentURL;
      const relSpecifier = isAlias ? specifier.slice(2) : specifier;
      if (base) {
        const candidate = new URL(`${relSpecifier}.ts`, base);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
