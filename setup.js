const fs = require("node:fs");
const path = require("node:path");

const src = path.join("node_modules", "three", "build", "three.module.js");
const destDir = path.join("scripts", "vendor");
const dest = path.join(destDir, "three.module.js");

if (!fs.existsSync(src)) {
  console.error(`[planetside setup] ${src} not found. Run 'npm install' first.`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[planetside setup] Vendored Three.js -> ${dest}`);
