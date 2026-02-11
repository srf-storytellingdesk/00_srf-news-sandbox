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

const HTML_REPLACEMENTS = {
  '[data-news-landmark="article-content"]': await fs.readFile(
    path.resolve(__dirname, "..", "template", "embed.html"),
    "utf8",
  ),
};

const TEXT_REPLACEMENTS = {
  title: "<%= title %>",
  ".article-title__overline": "Example Overline",
  ".article-title__text": "Example Headline Replacing Original Title",
  ".article-author__name span[itemprop='name']": "Example Author Name",
  ".article-lead": "",
};

const url =
  process.argv[2] ||
  "https://www.srf.ch/news/dialog/fehlende-berichterstattung-humanitaere-krisen-ohne-aufmerksamkeit";
const outputDir = process.argv[3] || "./template/public";

if (!url) {
  console.error(
    "Usage: node scripts/fetch-all-js-puppeteer.js <URL> <outputDir>",
  );
  process.exit(1);
}

await fs.mkdir(outputDir, { recursive: true });

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
      const outPath = path.join(outputDir, urlPath);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, css);
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
      const outPath = path.join(outputDir, urlPath);
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
      const outPath = path.join(outputDir, urlPath);
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

// Perform replacements based on HTML_REPLACEMENTS
await page.evaluate((replacements) => {
  for (const [selector, html] of replacements) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = html;
  }
}, Object.entries(HTML_REPLACEMENTS));

// Perform replacements based on TEXT_REPLACEMENTS
await page.evaluate((replacements) => {
  for (const [selector, html] of replacements) {
    const el = document.querySelector(selector);
    if (el) el.textContent = html;
  }
}, Object.entries(TEXT_REPLACEMENTS));

// Save the final HTML after all JS and replacements, prettified
let html = await page.content();
try {
  const prettierConfig =
    (await prettier.resolveConfig(process.cwd() + "/index.html")) || {};
  prettierConfig.parser = "html";
  html = await prettier.format(html, prettierConfig);
} catch (e) {
  console.warn("Could not prettify HTML with Prettier:", e.message);
}
const htmlPath = path.join(outputDir, "..", "index.html");
await fs.writeFile(htmlPath, html, { encoding: "utf8" });
console.log("Saved HTML:", htmlPath);

await browser.close();
console.log("Done.");
