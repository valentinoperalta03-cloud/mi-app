import { readFileSync, writeFileSync } from "fs";

const filePath = "ios/App/CapApp-SPM/Package.swift";
let content = readFileSync(filePath, "utf8");

if (content.includes("OneSignal-iOS-SDK")) {
  console.log("OneSignal already present, skipping.");
  process.exit(0);
}

// Mac (forward slashes) — lo que genera Codemagic
const macPreferences = `.package(name: "CapacitorPreferences", path: "../../../node_modules/@capacitor/preferences")`;
const macReplacement = `.package(name: "CapacitorPreferences", path: "../../../node_modules/@capacitor/preferences"),\n        .package(url: "https://github.com/OneSignal/OneSignal-iOS-SDK.git", from: "5.0.0")`;

// Windows (backslashes) — lo que genera Windows localmente
const winPreferences = `.package(name: "CapacitorPreferences", path: "..\\..\\..\\node_modules\\@capacitor\\preferences")`;
const winReplacement = `.package(name: "CapacitorPreferences", path: "..\\..\\..\\node_modules\\@capacitor\\preferences"),\n        .package(url: "https://github.com/OneSignal/OneSignal-iOS-SDK.git", from: "5.0.0")`;

const productReplacement = `.product(name: "CapacitorPreferences", package: "CapacitorPreferences"),\n                .product(name: "OneSignal", package: "OneSignal-iOS-SDK")`;

if (content.includes(macPreferences)) {
  content = content.replace(macPreferences, macReplacement);
} else if (content.includes(winPreferences)) {
  content = content.replace(winPreferences, winReplacement);
} else {
  console.error("ERROR: Could not find CapacitorPreferences package line. Content:");
  console.log(content);
  process.exit(1);
}

content = content.replace(
  `.product(name: "CapacitorPreferences", package: "CapacitorPreferences")`,
  productReplacement
);

writeFileSync(filePath, content, "utf8");
console.log("OneSignal SPM dependency added successfully.");
console.log(content);
