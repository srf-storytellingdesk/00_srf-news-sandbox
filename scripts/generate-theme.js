import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import { toHex, colorMixToHex } from "./utils/color-helper.js";
import {
  toCSS,
  resolveCssVariables,
  themeVariablesToCss,
} from "./utils/css-helper.js";
import { readScssVariables } from "./utils/file-helper.js";

const FETCH_URL =
  "https://www.srf.ch/article/019b2cbc-ac23-7005-62a9-0bfcf4e5c505";
const OUTPUT_FILE = "theme-override/themeVariables.scss";
const COLOR_VAR_LOOKUP =
  "../../00_srf-news-template/src/assets/styles/_newsColors.scss";

const THEME_VARIABLES = {
  "--t-news-body-bg": { scssVariable: "$warmgrey-1150" },
  "--t-news-interactive-bg": { scssVariable: "$warmgrey-900" },
  "--t-news-primary-bg": { scssVariable: "$warmgrey-1100" },
  "--t-news-primary-text": { scssVariable: "$warmgrey-10" },
  "--t-news-secondary-bg": { scssVariable: "$warmgrey-1000" },
  "--t-news-secondary-highlight-bg": { scssVariable: "$warmgrey-1050" },
  "--t-news-soft-red": { scssVariable: "$red-300" },
  "--t-news-soft-red-highlight": { scssVariable: "$red-200" },
  "--t-news-soft-grey": { scssVariable: "$warmgrey-300" },
  "--t-news-min-contrast": { scssVariable: "$neutral-black" },
  "--t-news-max-contrast": { scssVariable: "$neutral-white" },
  "--t-news-warmgrey-25": { scssVariable: "$warmgrey-25" },
  "--t-news-warmgrey-50": { scssVariable: "$warmgrey-50" },
  "--t-news-warmgrey-100": { scssVariable: "$warmgrey-100" },
  "--t-news-warmgrey-200": { scssVariable: "$warmgrey-200" },
  "--t-news-warmgrey-500": { scssVariable: "$warmgrey-500" },
  "--t-news-warmgrey-600": { scssVariable: "$warmgrey-600" },
  "--t-news-warmgrey-700": { scssVariable: "$warmgrey-700" },
  "--t-news-warmgrey-800": { scssVariable: "$warmgrey-800" },
  "--t-news-warmgrey-850": { scssVariable: "$warmgrey-850" },
  "--t-news-warmgrey-950": { scssVariable: "$warmgrey-950" },
};

const DEFAULT_VARIABLES = {
  "--t-news-body-bg": { scssVariable: "$warmgrey-25" },
  "--t-news-interactive-bg": { scssVariable: "$warmgrey-50" },
  "--t-news-primary-bg": { scssVariable: "$neutral-offwhite" },
  "--t-news-primary-text": { scssVariable: "$warmgrey-1100" },
  "--t-news-secondary-bg": { scssVariable: "$warmgrey-25" },
  "--t-news-secondary-highlight-bg": { scssVariable: "$warmgrey-10" },
  "--t-news-soft-red": { scssVariable: "$red-600" },
  "--t-news-soft-red-highlight": { scssVariable: "$red-800" },
  "--t-news-soft-grey": { scssVariable: "$warmgrey-800" },
  "--t-news-min-contrast": { scssVariable: "$neutral-white" },
  "--t-news-max-contrast": { scssVariable: "$neutral-black" },
  "--t-news-warmgrey-25": { scssVariable: "$warmgrey-1100" },
  "--t-news-warmgrey-50": { scssVariable: "$warmgrey-950" },
  "--t-news-warmgrey-100": { scssVariable: "$warmgrey-900" },
  "--t-news-warmgrey-200": { scssVariable: "$warmgrey-700" },
  "--t-news-warmgrey-500": { scssVariable: "$warmgrey-700" },
  "--t-news-warmgrey-600": { scssVariable: "$warmgrey-400" },
  "--t-news-warmgrey-700": { scssVariable: "$warmgrey-200" },
  "--t-news-warmgrey-800": { scssVariable: "$warmgrey-100" },
  "--t-news-warmgrey-850": { scssVariable: "$warmgrey-100" },
  "--t-news-warmgrey-950": { scssVariable: "$warmgrey-300" },
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputFile = path.resolve(OUTPUT_FILE);
const colorsFile = path.resolve(__dirname, COLOR_VAR_LOOKUP);

// create lookups for existing color variables
const colorVarLookup = await readScssVariables(colorsFile);
const varColorLookup = Object.fromEntries(
  Object.entries(colorVarLookup)
    .map(([k, v]) => [toHex(v), k])
    .filter(([k, v]) => k.startsWith("#")),
);

// First resolve SCSS variables to HEX, then resolve CSS variables (like color-mix) to HEX as well
// resolve SCSS variables to HEX
Object.entries(THEME_VARIABLES).forEach(([cssVar, { scssVariable }]) => {
  const color = colorVarLookup[scssVariable];
  if (color) {
    THEME_VARIABLES[cssVar].resolvedColor = toHex(color);
  }
  THEME_VARIABLES[cssVar].css = `#{${scssVariable}}`;
});

const hexToVarMap = Object.fromEntries(
  Object.entries(THEME_VARIABLES)
    .filter(([_, v]) => v.resolvedColor)
    .map(([cssVar, { resolvedColor }]) => [resolvedColor.slice(0, -2), cssVar]),
);

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(FETCH_URL, { waitUntil: "networkidle2" });

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
    const darkModeRules = collectDocumentsDarkModeRules().filter(
      (rule) => !rule.selector.includes("--theme"),
    );
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
for (const [cssVar, { resolvedColor }] of Object.entries(THEME_VARIABLES)) {
  if (!resolvedColor) continue;
  const colorPattern = new RegExp(`${resolvedColor}(?![0-9a-fA-F])`, "g");
  content = content.replace(colorPattern, `var(${cssVar})`);
}

// Compose output
const headerPart =
  "// This theme file was generated in 00_srf-news-sandbox\n@use '@Styles/newsColors' as *;\n\n";
const { rootVars, darkVars } = themeVariablesToCss(THEME_VARIABLES);

let defaultVarsBlock = "\n[data-theme='default'] {\n";
for (const [cssVar, { scssVariable }] of Object.entries(DEFAULT_VARIABLES)) {
  defaultVarsBlock += `  ${cssVar}: #{${scssVariable}};\n`;
}
defaultVarsBlock += "}\n\n";
const combinedVars = darkVars.replace("***/", defaultVarsBlock + "***/");

let remainingColors = content.match(/#([0-9a-fA-F]{1,8})\b/g);

// Loop through remaining hex colors and replace those matching without alpha, rewriting them with color-mix(...)
remainingColors.forEach((color) => {
  const baseColor = color.slice(0, -2);
  const alphaByte = color.slice(-2).toLowerCase();
  const alpha = parseInt(alphaByte, 16) / 255;
  if (alphaByte === "ff") {
    content = content.replace(new RegExp(color, "g"), baseColor);
    return;
  }
  const varName = hexToVarMap[baseColor];
  if (varName) {
    const replacement = `color-mix(in srgb, var(${varName}) ${Math.round(
      alpha * 100,
    )}%, transparent)`;
    content = content.replace(new RegExp(color, "g"), replacement);
  }
});

// For transparency reasons all remaining colors get logged
// (easily convertable into theme variables if identified as driving values for dark mode)
remainingColors = content.match(/#([0-9a-fA-F]{1,8})\b/g);
if (remainingColors) {
  // Count occurrences per color value
  const colorCounts = {};
  remainingColors.forEach((c) => {
    colorCounts[c] = (colorCounts[c] || 0) + 1;
  });
  console.log(
    "Remaining hardcoded colors (occurrences, color, sass variable):",
    [...new Set(remainingColors)]
      .map((c) => [colorCounts[c], c, varColorLookup[c] || "undefined color"])
      .sort((a, b) => b[0] - a[0]),
  );
} else {
  console.log("No remaining hardcoded colors found.");
}

if (typeof content !== "string") {
  console.error("The JS code must return a string (the SCSS content)");
  process.exit(1);
}

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, headerPart + rootVars + combinedVars + content, {
  encoding: "utf8",
});
console.log("Theme variables written to:", outputFile);
