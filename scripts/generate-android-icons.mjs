/**
 * Genera íconos de launcher Android desde public/logo.png
 * Uso: node scripts/generate-android-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const logoPath = path.join(root, "public", "logo.png");
const resRoot = path.join(root, "android", "app", "src", "main", "res");

const LAUNCHER_SIZES = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const FOREGROUND_SIZES = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

if (!fs.existsSync(logoPath)) {
  console.error("No se encontró public/logo.png");
  process.exit(1);
}

async function writeIcon(outPath, size, paddingRatio = 0.12) {
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const offset = Math.round((size - inner) / 2);
  const resized = await sharp(logoPath).resize(inner, inner, { fit: "contain" }).png().toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: offset, top: offset }])
    .png()
    .toFile(outPath);
}

async function main() {
  for (const [folder, size] of Object.entries(LAUNCHER_SIZES)) {
    const dir = path.join(resRoot, folder);
    fs.mkdirSync(dir, { recursive: true });
    await writeIcon(path.join(dir, "ic_launcher.png"), size, 0.08);
    await writeIcon(path.join(dir, "ic_launcher_round.png"), size, 0.08);
    console.log(`✓ ${folder}/ic_launcher.png (${size}px)`);
  }

  for (const [folder, size] of Object.entries(FOREGROUND_SIZES)) {
    const dir = path.join(resRoot, folder);
    fs.mkdirSync(dir, { recursive: true });
    await writeIcon(path.join(dir, "ic_launcher_foreground.png"), size, 0.18);
    console.log(`✓ ${folder}/ic_launcher_foreground.png (${size}px)`);
  }

  console.log("Íconos Android generados desde public/logo.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
