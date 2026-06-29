import puppeteer from "puppeteer";
import fs from "fs/promises";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import {
  mergeAllCssFiles,
  pointSrcAndHrefUrlsToSandbox,
  getUsedClassesFromHtml,
  extractInlineStyles,
  stripOriginFromCssUrls,
  downloadFile,
  downloadMissingAssets,
  parseAndDownloadFonts,
} from "./utils/file-helper.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configName = process.argv[2] || "srf";
const { default: config } = await import(`./configs/${configName}.js`);

const FETCH_URL = config.fetchUrl;
const TIME_TO_WAIT_FOR_DYNAMIC_CONTENT = 5000; // in milliseconds
const DELETE_SELECTORS = config.deleteSelectors;
const INSERT_SELECTORS = config.insertSelectors;
const TEXT_REPLACEMENTS = config.textReplacements;
const EMBED_TEMPLATE = config.embedTemplate || "embed_default.html";
const TME_TEMPLATE = config.tmeTemplate || "tme_default.html";
const MOUSTACHE_REPLACEMENTS = {
  ARTICLE_TITLE: "<%= title %>",
  ARTICLE_CONTENT: await fs.readFile(
    path.resolve(__dirname, "..", "template", EMBED_TEMPLATE),
    "utf8",
  ),
  TOP_MEDIA_ELEMENT: await fs.readFile(
    path.resolve(__dirname, "..", "template", TME_TEMPLATE),
    "utf8",
  ),
};

const PUBLIC_DIR = `./template/${configName}/public`;
const OUTPUT_DIR = "sandbox-assets";
const CSS_FILE_NAME = "merged.css";

const fetchUrlOrigin = new URL(FETCH_URL).origin;
const outputDirPath = path.join(PUBLIC_DIR, OUTPUT_DIR);
await fs.mkdir(PUBLIC_DIR, { recursive: true });
await fs.mkdir(outputDirPath, {
  recursive: true,
});

// Symlink template/src into the platform dir so Vite can resolve it
const srcSymlink = path.resolve(`./template/${configName}/src`);
try {
  await fs.symlink("../src", srcSymlink, "dir");
} catch (e) {
  if (e.code !== "EEXIST") throw e;
}

// empty output directory before saving new files
const existingFiles = await fs.readdir(outputDirPath);
await Promise.all(
  existingFiles.map((file) =>
    fs.rm(path.join(outputDirPath, file), { recursive: true }),
  ),
);

const browser = await puppeteer.launch();
const page = await browser.newPage();

const assetSeen = new Set();
const assetTypes = [
  {
    test: (ct, url) => ct.includes("css") || url.match(/\.css(\?|$)/),
    ext: "css",
    encoding: "utf8",
    fallbackExt: ".css",
  },
  {
    test: (ct, url) =>
      url.match(/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|$)/i),
    ext: "img",
  },
  {
    test: (ct, url) =>
      ct.startsWith("font/") ||
      ct.includes("woff") ||
      ct.includes("truetype") ||
      ct.includes("opentype") ||
      url.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i),
    ext: "font",
  },
];

page.on("response", async (response) => {
  try {
    const reqUrl = response.url();
    const ct = response.headers()["content-type"] || "";
    if (reqUrl.toString().includes("base64,")) return;
    if (!reqUrl.toString().startsWith(fetchUrlOrigin)) return;

    for (const type of assetTypes) {
      if (type.test(ct, reqUrl) && !assetSeen.has(reqUrl)) {
        assetSeen.add(reqUrl);
        downloadFile(response, outputDirPath, type.encoding, type.fallbackExt);
        return;
      }
    }
  } catch (e) {
    console.warn("Error saving asset:", e.message);
  }
});

await page.goto(FETCH_URL, { waitUntil: "networkidle2" });
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
await page.evaluate(
  ({ replacements, inserts }) => {
    for (const [selector, text] of replacements) {
      const el = document.querySelector(selector);
      if (el) el.textContent = text;
    }
    for (const [rawSelector, text] of inserts) {
      const doPrepend = rawSelector.startsWith("^");
      const selector = doPrepend ? rawSelector.slice(1) : rawSelector;
      const el = document.querySelector(selector);
      if (el) {
        const textNode = document.createTextNode(text);
        doPrepend ? el.prepend(textNode) : el.append(textNode);
      }
    }
  },
  {
    replacements: Object.entries(TEXT_REPLACEMENTS),
    inserts: Object.entries(INSERT_SELECTORS),
  },
);

await page.evaluate((cssHref) => {
  // Remove all stylesheet links and create a new one for the merged CSS file
  document
    .querySelectorAll("link[rel='stylesheet']")
    .forEach((el) => el.remove());
  const mergedCssLink = document.createElement("link");
  mergedCssLink.rel = "stylesheet";
  mergedCssLink.href = cssHref;
  document.head.appendChild(mergedCssLink);

  // remove hyperlinks
  document.querySelectorAll("a[href]").forEach((a) => {
    a.setAttribute("href", "#");
  });
}, `/${OUTPUT_DIR}/${CSS_FILE_NAME}`);

// Save the final HTML after all JS and replacements, but only include merged.css
let html = await page.content();
await browser.close();

// rewrite urls to point to the sandbox-assets directory
// (example: /deeply/nested/srf-apple-touch-icon-BRxTgjQQ.png => ./sandbox-assets/deeply/nested/srf-apple-touch-icon-BRxTgjQQ.png)
html = pointSrcAndHrefUrlsToSandbox(html, fetchUrlOrigin);

// extract <style> blocks from HTML so they end up in merged.css
// strip the origin from absolute URLs (Puppeteer resolves relative URLs to absolute in serialized DOM)
const { html: htmlWithoutStyles, styles: rawInlineStyles } =
  extractInlineStyles(html);
html = htmlWithoutStyles;
const inlineStyles = stripOriginFromCssUrls(rawInlineStyles, fetchUrlOrigin);

// list classes used in the HTML
const classSet = getUsedClassesFromHtml(html);

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

// Download any assets referenced in HTML that Puppeteer missed (e.g. SVG sprites in <use href>)
await downloadMissingAssets(html, outputDirPath, fetchUrlOrigin);

// Merge all CSS files in outputDirPath, including any inline <style> blocks
const css = await mergeAllCssFiles(
  outputDirPath,
  CSS_FILE_NAME,
  classSet,
  true,
  inlineStyles,
);

await parseAndDownloadFonts(css, outputDirPath, (src) =>
  src.replace("../" + OUTPUT_DIR, fetchUrlOrigin),
);

console.log("Done.");

execSync(`node ${path.join(__dirname, "screenshot.js")} ${configName}`, {
  stdio: "inherit",
});
