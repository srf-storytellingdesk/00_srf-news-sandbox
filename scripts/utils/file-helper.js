import fs from "fs/promises";
import path from "path";

// Remove all CSS files except merged.css from the directory and subdirectories
async function removeMergedCssFiles(dir, mergedName) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeMergedCssFiles(fullPath, mergedName);
      // remove directory if empty after processing
      const remainingEntries = await fs.readdir(fullPath);
      if (remainingEntries.length === 0) {
        await fs.rmdir(fullPath);
      }
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
  classesUsed = new Set(),
  removeMergedFiles = true,
) {
  const cssFiles = await collectCssFiles(dir, mergedName);
  let merged = "";
  for (const file of cssFiles) {
    merged += `/* --- ${path.relative(dir, file)} --- */\n`;
    let fileContent = await fs.readFile(file, "utf8");
    // fileContent = removeUnusedClasses(fileContent, classesUsed);
    fileContent = pointAssetUrlsToSandbox(fileContent);
    merged += fileContent;
    merged += "\n";
  }
  const mergedPath = path.join(dir, mergedName);

  await fs.writeFile(mergedPath, merged, { encoding: "utf8" });
  console.log("Merged CSS written to:", mergedPath);

  if (removeMergedFiles) {
    await removeMergedCssFiles(dir, mergedName);
  }
}

export function getUsedClassesFromHtml(htmlContent) {
  const classSet = new Set();
  htmlContent.replace(/class=["']([^"']+)["']/g, (_, classList) => {
    classList.split(/\s+/).forEach((cls) => classSet.add(cls));
  });
  return classSet;
}

export function getDefinedClasses(cssContent) {
  const cssClasses = new Set();
  cssContent.replace(/\.([a-zA-Z0-9_-]+)\b/g, (_, className) =>
    cssClasses.add(className),
  );
  return cssClasses;
}

export function removeUnusedClasses(cssContent, classesUsed) {
  const cssClasses = getDefinedClasses(cssContent);
  cssClasses.forEach((cls) => {
    if (!classesUsed.has(cls)) {
      console.log(`Class .${cls} is in CSS but not used in HTML, removing...`);
      // Match class block, minified or not (no dependency on trailing newline)
      const classPattern = new RegExp(`\\.${cls}[^{{}]*{[^}]*}`, "g");
      cssContent = cssContent.replace(classPattern, "");
    }
  });
  return cssContent;
}

export function pointAssetUrlsToSandbox(input) {
  return String(input).replace(
    // Match real URL-like paths:
    // - optional leading slash
    // - at least one "/" segment
    // - no whitespace
    // - not already sandbox-prefixed
    /(^|[^A-Za-z0-9/_-])\/?(?!sandbox-assets\/)([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+)/g,
    (_, pre, path) => `${pre}../sandbox-assets/${path}`,
  );
}

export function pointSrcAndHrefUrlsToSandbox(input) {
  let out = String(input).replace(
    /((?:src|href)=["'])(\/(?!sandbox-assets\/|\/|https?:\/\/)[^"']+)["']/g,
    (match, prefix, url) => `${prefix}./sandbox-assets/${url.slice(1)}"`,
  );
  // srcset: handle multiple URLs separated by comma, possibly with descriptors
  out = out.replace(/(srcset=["'])([^"']+)["']/g, (match, prefix, value) => {
    const rewritten = value
      .split(",")
      .map((part) => {
        let [url, ...rest] = part.trim().split(/\s+/);
        if (
          url.startsWith("/sandbox-assets/") ||
          url.startsWith("http://") ||
          url.startsWith("https://") ||
          url.startsWith("//")
        ) {
          return part.trim();
        }
        if (url.startsWith("/")) url = `./sandbox-assets/${url.slice(1)}`;
        return [url, ...rest].join(" ");
      })
      .join(", ");
    return `${prefix}${rewritten}"`;
  });
  return out;
}
