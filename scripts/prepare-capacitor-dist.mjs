/**
 * Prepara capacitor-dist para cap sync (shell inteligente + assets estáticos).
 * La plantilla vive en shell-template.html; index.html se genera en cada build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "capacitor-dist");
const publicDir = path.join(root, "public");
const templatePath = path.join(distDir, "shell-template.html");
const indexHtml = path.join(distDir, "index.html");

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

fs.mkdirSync(distDir, { recursive: true });

if (!fs.existsSync(templatePath)) {
  console.error("Missing capacitor-dist/shell-template.html");
  process.exit(1);
}

const SHELL_HTML = fs.readFileSync(templatePath, "utf8");
fs.writeFileSync(indexHtml, SHELL_HTML, "utf8");
console.log("Escrito capacitor-dist/index.html desde shell-template.html");

if (fs.existsSync(publicDir)) {
  copyRecursive(publicDir, path.join(distDir, "public"));
  console.log("Copiado public/ → capacitor-dist/public/");
}

console.log("capacitor-dist listo para npx cap sync");
