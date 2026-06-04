import { readFileSync, writeFileSync } from "fs";

const filePath = "ios/App/CapApp-SPM/Package.swift";
let content = readFileSync(filePath, "utf8");

if (content.includes("OnesignalCapacitorPlugin")) {
  console.log("OneSignal already present, skipping.");
  process.exit(0);
}

// Mac (forward slashes) — Codemagic
const macPreferences = `.package(name: "CapacitorPreferences", path: "../../../node_modules/@capacitor/preferences")`;
const macReplacement = `.package(name: "CapacitorPreferences", path: "../../../node_modules/@capacitor/preferences"),
        .package(name: "OnesignalCapacitorPlugin", path: "../../../node_modules/@onesignal/capacitor-plugin")`;

// Windows (backslashes) — local
const winPreferences = `.package(name: "CapacitorPreferences", path: "..\\..\\..\\node_modules\\@capacitor\\preferences")`;
const winReplacement = `.package(name: "CapacitorPreferences", path: "..\\..\\..\\node_modules\\@capacitor\\preferences"),
        .package(name: "OnesignalCapacitorPlugin", path: "..\\..\\..\\node_modules\\@onesignal\\capacitor-plugin")`;

const productReplacement = `.product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "OnesignalCapacitorPlugin", package: "OnesignalCapacitorPlugin")`;

if (content.includes(macPreferences)) {
  content = content.replace(macPreferences, macReplacement);
} else if (content.includes(winPreferences)) {
  content = content.replace(winPreferences, winReplacement);
} else {
  console.error("ERROR: Could not find CapacitorPreferences line. Content:");
  console.log(content);
  process.exit(1);
}

content = content.replace(
  `.product(name: "CapacitorPreferences", package: "CapacitorPreferences")`,
  productReplacement
);

writeFileSync(filePath, content, "utf8");
console.log("OnesignalCapacitorPlugin SPM dependency added successfully.");
console.log(content);
