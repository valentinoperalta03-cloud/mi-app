/**
 * Prepara capacitor-dist para cap sync (shell con redirect + assets estáticos).
 * Con server.url la app carga el sitio remoto; el shell local evita WebView vacío en Android.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const distDir = path.join(root, "capacitor-dist");
const publicDir = path.join(root, "public");
const indexHtml = path.join(distDir, "index.html");

const SHELL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0;url=https://www.padelibre.online/login">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <script>window.location.replace('https://www.padelibre.online/login');</script>
</body>
</html>
`;

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
fs.writeFileSync(indexHtml, SHELL_HTML, "utf8");
console.log("Escrito capacitor-dist/index.html (redirect a /login)");

if (fs.existsSync(publicDir)) {
  copyRecursive(publicDir, path.join(distDir, "public"));
  console.log("Copiado public/ → capacitor-dist/public/");
}

console.log("capacitor-dist listo para npx cap sync");
