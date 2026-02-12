import fs from "fs/promises";
import path from "path";

// Remove all CSS files except merged.css from the directory and subdirectories
async function removeMergedCssFiles(dir, mergedName) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeMergedCssFiles(fullPath, mergedName);
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".css") &&
      entry.name !== mergedName
    ) {
      await fs.unlink(fullPath);
      console.log("Removed CSS file:", fullPath);
    }
  }
}

async function collectCssFiles(dir, mergedName) {
  let cssFiles = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cssFiles = cssFiles.concat(await collectCssFiles(fullPath, mergedName));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".css") &&
      entry.name !== mergedName
    ) {
      cssFiles.push(fullPath);
    }
  }
  return cssFiles;
}

export async function mergeAllCssFiles(
  dir,
  mergedName,
  removeMergedFiles = true,
) {
  const cssFiles = await collectCssFiles(dir, mergedName);
  let merged = "";
  for (const file of cssFiles) {
    merged += `/* --- ${path.relative(dir, file)} --- */\n`;
    merged += await fs.readFile(file, "utf8");
    merged += "\n";
  }
  const mergedPath = path.join(dir, mergedName);
  merged = pointAssetUrlsToSandbox(merged);
  merged = pointCssAssetUrlsToSandbox(merged);
  await fs.writeFile(mergedPath, merged, { encoding: "utf8" });
  console.log("Merged CSS written to:", mergedPath);

  if (removeMergedFiles) {
    await removeMergedCssFiles(dir, mergedName);
  }
}

export function pointAssetUrlsToSandbox(code) {
  return code.replace(
    /(["'])\/([^"']*?)\/([^"']*?)\1/g,
    (match, quote, path1, filename) => {
      const newPath = `./sandbox-assets/${path1}/${filename}`;
      return `${quote}${newPath}${quote}`;
    },
  );
}

export function pointCssAssetUrlsToSandbox(css) {
  // Accept Buffer or string
  if (Buffer.isBuffer(css)) css = css.toString("utf8");
  return css.replace(
    /(["']?)\/([^"']*?)\/([^"']*?)\1/g,
    (match, quote, path1, filename) => {
      const newPath = `./sandbox-assets/${path1}/${filename}`;
      return `${quote}${newPath}${quote}`;
    },
  );
}
