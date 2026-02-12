// This script uses Puppeteer to visit a page and download all JS files loaded by the browser (including dynamic imports)
// Usage: node scripts/fetch-all-js-puppeteer.js <URL> <outputDir>

import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIME_TO_WAIT_FOR_DYNAMIC_CONTENT = 5000; // in milliseconds

const DELETE_SELECTORS = [
  "script", // no js scripts (let the browser execute them, we just want the final HTML and assets)
  "meta:not([charset])", // no meta tags except charset
  'link[as="script"]', // no preloading of js files
  'link[crossorigin="use-credentials"]', // no manifests needed
  '[data-js-plugin="dynamic-promo-banner"]', // no promo stuff needed
];

const TEXT_REPLACEMENTS = {
  title: "{{ARTICLE_TITLE}}",
  '[data-news-landmark="article-content"]': "{{ARTICLE_CONTENT}}",
  ".article-title__overline": "Example Overline",
  ".article-title__text": "Example Headline Replacing Original Title",
  ".article-author__name span[itemprop='name']": "Example Author Name",
  ".article-lead": "",
};

const MOUSTACHE_REPLACEMENTS = {
  ARTICLE_CONTENT: await fs.readFile(
    path.resolve(__dirname, "..", "template", "embed.html"),
    "utf8",
  ),
  ARTICLE_TITLE: "<%= title %>",
};

const url =
  process.argv[2] ||
  "https://www.srf.ch/news/dialog/fehlende-berichterstattung-humanitaere-krisen-ohne-aufmerksamkeit";
const publicDir = process.argv[3] || "./template/public";

const outputDir = process.argv[4] || "sandbox-assets";

const cssFileName = process.argv[5] || "merged.css";

if (!url) {
  console.error(
    "Usage: node scripts/fetch-all-js-puppeteer.js <URL> <publicDir> <outputDir> <cssFileName>",
  );
  process.exit(1);
}

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
// --- Merge all CSS files in outputDir into one merged.css ---
// Recursively collect all CSS files in a directory (excluding merged.css)
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

async function mergeAllCssFiles(dir, mergedName) {
  const cssFiles = await collectCssFiles(dir, mergedName);
  let merged = "";
  for (const file of cssFiles) {
    merged += `/* --- ${path.relative(dir, file)} --- */\n`;
    merged += await fs.readFile(file, "utf8");
    merged += "\n";
  }
  const mergedPath = path.join(dir, mergedName);
  merged = pointAssetUrlsToSandbox(merged);
  await fs.writeFile(mergedPath, merged, { encoding: "utf8" });
  console.log("Merged CSS written to:", mergedPath);
}

function pointAssetUrlsToSandbox(code) {
  return code.replace(
    /(["'])\/([^"']*?)\/([^"']*?)\1/g,
    (match, quote, path1, filename) => {
      const newPath = `./sandbox-assets/${path1}/${filename}`;
      return `${quote}${newPath}${quote}`;
    },
  );
}

// --- Helper to patch staticfiles paths in CSS ---
function patchStaticfilesInCss(css, newBase = "/sandbox-assets/staticfiles") {
  // Accept Buffer or string
  if (Buffer.isBuffer(css)) css = css.toString("utf8");
  // return css.replace(
  //   /url\((['"]?)\/staticfiles\//g,
  //   (match, quote) => `url(${quote}${newBase.replace(/\/$/, "")}/`,
  // );

  return css.replace(
    /(["']?)\/([^"']*?)\/([^"']*?)\1/g,
    (match, quote, path1, filename) => {
      const newPath = `./sandbox-assets/${path1}/${filename}`;
      return `${quote}${newPath}${quote}`;
    },
  );
}

const outputDirPath = path.join(publicDir, outputDir);
await fs.mkdir(publicDir, { recursive: true });
await fs.mkdir(outputDirPath, {
  recursive: true,
});

// empty output directory before saving new files
const existingFiles = await fs.readdir(outputDirPath);
await Promise.all(
  existingFiles.map((file) =>
    fs.rm(path.join(outputDirPath, file), { recursive: true }),
  ),
);

const browser = await puppeteer.launch();
const page = await browser.newPage();

const cssSeen = new Set();
const cssFiles = [];

page.on("response", async (response) => {
  try {
    const reqUrl = response.url();
    const ct = response.headers()["content-type"] || "";

    // Download CSS
    if (ct.includes("css") || reqUrl.match(/\.css(\?|$)/)) {
      if (cssSeen.has(reqUrl)) return;
      cssSeen.add(reqUrl);
      const css = await response.buffer();
      // Preserve directory structure relative to the domain
      let urlPath = reqUrl.replace(/^https?:\/\/[\w\.-]+/, "");
      if (urlPath.startsWith("/")) urlPath = urlPath.slice(1);
      // Remove query string
      urlPath = urlPath.split("?")[0];
      const outPath = path.join(outputDirPath, urlPath);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      // Patch staticfiles paths in CSS before writing
      const patchedCss = patchStaticfilesInCss(css);
      await fs.writeFile(outPath, patchedCss, { encoding: "utf8" });
      cssFiles.push(urlPath);
      console.log("Saved CSS:", outPath);
      return;
    }

    // Download images (common types)
    if (
      ct.startsWith("image/") ||
      reqUrl.match(/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|$)/i)
    ) {
      let urlPath = reqUrl.replace(/^https?:\/\/[\w\.-]+/, "");
      if (urlPath.startsWith("/")) urlPath = urlPath.slice(1);
      urlPath = urlPath.split("?")[0];
      const outPath = path.join(outputDirPath, urlPath);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      const img = await response.buffer();
      await fs.writeFile(outPath, img);
      console.log("Saved image:", outPath);
      return;
    }

    // Download fonts (woff, woff2, ttf, otf, eot, font/ content-type)
    if (
      ct.startsWith("font/") ||
      ct.includes("woff") ||
      ct.includes("truetype") ||
      ct.includes("opentype") ||
      reqUrl.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i)
    ) {
      let urlPath = reqUrl.replace(/^https?:\/\/[\w\.-]+/, "");
      if (urlPath.startsWith("/")) urlPath = urlPath.slice(1);
      urlPath = urlPath.split("?")[0];
      const outPath = path.join(outputDirPath, urlPath);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      const font = await response.buffer();
      await fs.writeFile(outPath, font);
      console.log("Saved font:", outPath);
      return;
    }
  } catch (e) {
    console.warn("Error saving CSS:", e.message);
  }
});

await page.goto(url, { waitUntil: "networkidle2" });
// Wait longer for dynamic content
await new Promise((resolve) =>
  setTimeout(resolve, TIME_TO_WAIT_FOR_DYNAMIC_CONTENT),
);

// Scroll to bottom to trigger lazy loading
await page.evaluate(async () => {
  await new Promise((resolve) => {
    let totalHeight = 0;
    const distance = 500;
    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      totalHeight += distance;
      if (totalHeight >= document.body.scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, 300);
  });
});

// Wait again for images to load after scrolling (5s)
await new Promise((resolve) => setTimeout(resolve, 5000));

// Perform deletions based on DELETE_SELECTORS
await page.evaluate((selectors) => {
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => el.remove());
  });
}, DELETE_SELECTORS);

// Perform replacements based on TEXT_REPLACEMENTS
await page.evaluate((replacements) => {
  for (const [selector, html] of replacements) {
    const el = document.querySelector(selector);
    if (el) el.textContent = html;
  }
}, Object.entries(TEXT_REPLACEMENTS));

// Perform CSS merging
await page.evaluate((cssHref) => {
  // remove all stylesheets
  document
    .querySelectorAll("link[rel='stylesheet']")
    .forEach((el) => el.remove());

  // add one stylesheet link for merged.css (will be patched later to point to the correct path)
  const mergedCssLink = document.createElement("link");
  mergedCssLink.rel = "stylesheet";
  mergedCssLink.href = cssHref;
  document.head.appendChild(mergedCssLink);
}, `./${outputDir}/${cssFileName}`);

// Save the final HTML after all JS and replacements, but only include merged.css
let html = await page.content();

// rewrite urls to point to the sandbox-assets directory
// (example: /deeply/nested/srf-apple-touch-icon-BRxTgjQQ.png => ./sandbox-assets/deeply/nested/srf-apple-touch-icon-BRxTgjQQ.png)
html = pointAssetUrlsToSandbox(html);

// Perform replacements based on MOUSTACHE_REPLACEMENTS
for (const [placeholder, replacement] of Object.entries(
  MOUSTACHE_REPLACEMENTS,
)) {
  const moustachedPlaceholder = `{{${placeholder}}}`;
  html = html.replace(new RegExp(moustachedPlaceholder, "g"), replacement);
}

try {
  const prettierConfig =
    (await prettier.resolveConfig(process.cwd() + "/index.html")) || {};
  prettierConfig.parser = "html";
  html = await prettier.format(html, prettierConfig);
} catch (e) {
  console.warn("Could not prettify HTML with Prettier:", e.message);
}

const htmlPath = path.join(outputDirPath, "..", "..", "index.html");
await fs.writeFile(htmlPath, html, { encoding: "utf8" });
console.log("Saved HTML:", htmlPath);

await browser.close();

// Merge all CSS files in outputDirPath
await mergeAllCssFiles(outputDirPath, cssFileName);
// Remove all CSS files except merged.css
await removeMergedCssFiles(outputDirPath, cssFileName);

console.log("Done.");
