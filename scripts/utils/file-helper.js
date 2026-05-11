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

  return merged;
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
  // Only rewrite URLs inside url(...) in CSS
  return String(input).replace(
    /url\((['"]?)(\/[^'"\)]*)\1\)/g,
    (match, quote, url) => {
      if (
        url.startsWith("/sandbox-assets/") ||
        url.startsWith("//") ||
        url.match(/^https?:\//)
      ) {
        return match;
      }
      return `url(${quote}../sandbox-assets${url}${quote})`;
    },
  );
}

export function pointSrcAndHrefUrlsToSandbox(input) {
  let out = String(input).replace(
    /((?:src|href)=["'])(\/(?!sandbox-assets\/|\/|https?:\/\/)[^"']+)["']/g,
    (match, prefix, url) => `${prefix}/sandbox-assets/${url.slice(1)}"`,
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
        if (url.startsWith("/")) url = `/sandbox-assets/${url.slice(1)}`;
        return [url, ...rest].join(" ");
      })
      .join(", ");
    return `${prefix}${rewritten}"`;
  });
  return out;
}

export async function downloadFile(response, dirPath, encoding) {
  const reqUrl =
    typeof response?.url === "function" ? response.url() : response?.url;

  if (typeof reqUrl !== "string" || reqUrl.length === 0) {
    throw new Error(`downloadFile(): response has no url/url()`);
  }

  let urlPath = reqUrl.replace(/^https?:\/\/[^/]+\/?/, "");
  urlPath = urlPath.split("?")[0].split("#")[0];
  if (urlPath.startsWith("/")) urlPath = urlPath.slice(1);

  const outPath = path.join(dirPath, urlPath);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const data =
    typeof response?.buffer === "function"
      ? await response.buffer()
      : Buffer.from(await response.arrayBuffer());

  await fs.writeFile(outPath, data, encoding ? { encoding } : undefined);
  console.log("Save:", outPath);
}

export async function parseAndDownloadFonts(
  cssContent,
  outputDir,
  pipeFnc = (src) => src,
) {
  // find all font face definitions in css and get sources
  const fontFaceRegex = /@font-face\s*{[^}]*}/g;
  const fontFaces = cssContent.match(fontFaceRegex) || [];
  const fontSources = fontFaces
    .map((fontFace) => {
      const srcMatch = fontFace.match(/src:\s*url\(([^)]+)\)/);
      return srcMatch ? srcMatch[1] : null;
    })
    .filter(Boolean)
    .filter((src) => !src.includes("data:"))
    .map((src) => src.replace(/['"]/g, ""))
    .map((src) => {
      const rewritten = pipeFnc(src);
      return rewritten || src;
    });

  for (const src of fontSources) {
    try {
      const response = await fetch(src);
      if (!response.ok)
        throw new Error(`Failed to fetch ${src}: ${response.status}`);
      // console.log(`Downloading font from ${src}...`);
      await downloadFile(response, outputDir);
    } catch (e) {
      console.warn("Error downloading font:", e.message);
    }
  }
}

export async function readScssVariables(scssFilePath) {
  const scss = await fs.readFile(scssFilePath, "utf8");
  const varToColor = {};
  const varRegex = /\$(\w[\w-]*):\s*([^;]+);/g;
  let match;
  while ((match = varRegex.exec(scss)))
    varToColor[`$${match[1]}`] = match[2].trim();
  return varToColor;
}
