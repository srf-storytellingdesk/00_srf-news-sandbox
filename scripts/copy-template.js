import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const targetName = process.argv[2] || "00_srf-news-template";
const targetDir = path.resolve(ROOT, "..", targetName);

console.log(`Copying template to: ${targetDir}`);

const srcHtml = path.join(ROOT, "template", "index.html");
const srcAssets = path.join(ROOT, "template", "public", "sandbox-assets");
const destHtml = path.join(targetDir, "index.html");
const destAssets = path.join(targetDir, "public", "sandbox-assets");

await fs.copyFile(srcHtml, destHtml);

await fs.rm(destAssets, { recursive: true, force: true });

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) => {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      return entry.isDirectory() ? copyDir(s, d) : fs.copyFile(s, d);
    }),
  );
}

await copyDir(srcAssets, destAssets);

console.log("Done.");
