import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const copyTargets = [
  "index.html",
  "styles.css",
  "src",
  "assets"
];

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  for (const target of copyTargets) {
    await cp(path.join(rootDir, target), path.join(distDir, target), { recursive: true });
  }
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
