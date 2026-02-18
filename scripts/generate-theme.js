// Usage: node scripts/fetch-theme-vars.js <URL> <JS_CODE_FILE>
// Example: node scripts/fetch-theme-vars.js https://example.com scripts/extract-theme-vars.js

import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import { toHex } from "./utils/color-helper.js";
import { isDarkModeMedia, extractRules, toCSS } from "./utils/css-helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colorsFile = path.resolve(
  __dirname,
  "../../00_srf-news-template/src/assets/styles/_newsColors.scss",
);

const mapping = {
  "--t-news-body-bg": "$warmgrey-1150",
  "--t-news-interactive-bg": "$warmgrey-900",
  "--t-news-primary-bg": "$warmgrey-1100",
  "--t-news-primary-text": "$warmgrey-10",
  "--t-news-secondary-bg": "$warmgrey-1000",
  "--t-news-secondary-highlight-bg": "$warmgrey-1050",
  "--t-news-soft-red": "$red-300",
  "--t-news-soft-red-highlight": "$red-200",
  "--t-news-soft-grey": "$warmgrey-300",
  "--t-news-black": "$neutral-black",
  "--t-news-white": "$neutral-white",
};

const allowValue = ["--t-news-black", "--t-news-white"];

function buildThemeVars(mapping, allowValue) {
  let rootVars = ":root {\n";
  let darkVars = "\n[data-theme='dark'] {\n";
  for (const [cssVar, color] of Object.entries(mapping)) {
    const defaultValue = allowValue.includes(cssVar) ? `#{${color}}` : "unset";
    rootVars += `  ${cssVar}: ${defaultValue};\n`;
    if (!allowValue.includes(cssVar)) {
      darkVars += `  ${cssVar}: #{${color}};\n`;
    }
  }
  rootVars += "}\n";
  darkVars += "}\n\n";
  return { rootVars, darkVars };
}
const url =
  process.argv[2] ||
  "https://www.srf.ch/article/019b2cbc-ac23-7005-62a9-0bfcf4e5c505";
// const jsCodeFile =
//   process.argv[3] || "scripts/assets/parse-darktheme-overrides.js";
const outputFile = path.resolve("theme-override/themeVariables.scss");

if (!url) {
  console.error("Usage: node scripts/fetch-theme-vars.js <URL> <JS_CODE_FILE>");
  process.exit(1);
}

// Parse _newsColors.scss and build color maps
const scss = await fs.readFile(colorsFile, "utf8");
const varToColor = {};
const varRegex = /\$(\w[\w-]*):\s*([^;]+);/g;
let match;
while ((match = varRegex.exec(scss)))
  varToColor[`$${match[1]}`] = match[2].trim();

const colorToCssVar = {};
for (const [cssVar, scssVar] of Object.entries(mapping)) {
  const color = varToColor[scssVar];
  if (color) colorToCssVar[toHex(color)] = cssVar;
}

// const jsCode = await fs.readFile(jsCodeFile, "utf8");

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle2" });

async function injectHelpers(page, helpers) {
  for (const helper of helpers) {
    let code = await fs.readFile(path.resolve(__dirname, helper), "utf8");
    code = code.replace(/export function (\w+)/g, "window.$1 = function $1");
    await page.addScriptTag({ content: code });
  }
}
await injectHelpers(page, ["./utils/color-helper.js", "./utils/css-helper.js"]);

// Call the helper function from the module script inside evaluate
let content = await page.evaluate(async () => {
  if (typeof window.isDarkModeMedia !== "function") {
    await new Promise((r) => setTimeout(r, 4000));
    if (typeof window.isDarkModeMedia !== "function")
      throw new Error("window.isDarkModeMedia is not available.");
  }
  try {
    const darkModeRules = collectDocumentsDarkModeRules();
    const mediaGroups = {};
    darkModeRules.forEach((rule) => {
      if (!mediaGroups[rule.media]) mediaGroups[rule.media] = [];
      mediaGroups[rule.media].push(rule);
    });
    let stylesheetString = "";
    Object.keys(mediaGroups).forEach((media) => {
      const mergedBySelector = {};
      mediaGroups[media].forEach((rule) => {
        if (!mergedBySelector[rule.selector])
          mergedBySelector[rule.selector] = {
            ...rule,
            styles: { ...rule.styles },
          };
        else Object.assign(mergedBySelector[rule.selector].styles, rule.styles);
      });
      const rootStyles = mergedBySelector[":root"]
        ? { ...mergedBySelector[":root"].styles }
        : {};
      const bodyStyles = mergedBySelector["body"]
        ? { ...mergedBySelector["body"].styles }
        : {};
      delete mergedBySelector[":root"];
      delete mergedBySelector["body"];
      const sortedSelectors = Object.keys(mergedBySelector).sort(
        (a, b) => selectorRank(a) - selectorRank(b) || a.localeCompare(b),
      );
      stylesheetString += `body[data-theme] {\n`;
      stylesheetString += toCSS(
        { selector: ":root", styles: rootStyles },
        true,
      );
      stylesheetString += toCSS({ selector: "body", styles: bodyStyles }, true);
      sortedSelectors.forEach(
        (selector) => (stylesheetString += toCSS(mergedBySelector[selector])),
      );
      stylesheetString += "}\n\n";
    });
    return stylesheetString;
  } catch (error) {
    console.error("❌ Error scanning stylesheets:", error);
    return "";
  }
});
await browser.close();

// Replace hardcoded color values in the content with CSS variables
for (const [color, cssVar] of Object.entries(colorToCssVar)) {
  const colorPattern = new RegExp(`${color}(?![0-9a-fA-F])`, "g");
  content = content.replace(colorPattern, `var(${cssVar})`);
}

// Compose output
const headerPart =
  "// This theme file was generated in 00_srf-news-sandbox\n@use '@Styles/newsColors' as *;\n\n";
const { rootVars, darkVars } = buildThemeVars(mapping, allowValue);

const remainingColors = content.match(/#([0-9a-fA-F]{1,8})\b/g);
if (remainingColors) {
  console.log("Remaining hardcoded colors:", [...new Set(remainingColors)]);
} else {
  console.log("No remaining hardcoded colors found.");
}

if (typeof content !== "string") {
  console.error("The JS code must return a string (the SCSS content)");
  process.exit(1);
}

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, headerPart + rootVars + darkVars + content, {
  encoding: "utf8",
});
console.log("Theme variables written to:", outputFile);
