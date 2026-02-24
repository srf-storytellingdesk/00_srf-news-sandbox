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
  "--t-news-black": {
    scssVariable: "$neutral-black",
    ignoreInCustomTheme: true,
  },
  "--t-news-white": {
    scssVariable: "$neutral-white",
    ignoreInCustomTheme: true,
  },
  "--t-news-white-a7": {
    css: "color-mix(in srgb, var(--t-news-white) 7.8%, transparent)",
    ignoreInCustomTheme: true,
  },
  "--t-news-white-a12": {
    css: "color-mix(in srgb, var(--t-news-white) 12%, transparent)",
    ignoreInCustomTheme: true,
  },
  "--t-news-white-a24": {
    css: "color-mix(in srgb, var(--t-news-white) 24%, transparent)",
    ignoreInCustomTheme: true,
  },
  "--t-news-black-a7": {
    css: "color-mix(in srgb, var(--t-news-black) 7.8%, transparent)",
    ignoreInCustomTheme: true,
  },
  "--t-news-black-a12": {
    css: "color-mix(in srgb, var(--t-news-black) 12%, transparent)",
    ignoreInCustomTheme: true,
  },
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
Object.entries(THEME_VARIABLES)
  .filter(([_, { scssVariable }]) => scssVariable)
  .forEach(([cssVar, { scssVariable }]) => {
    const color = colorVarLookup[scssVariable];
    if (color) {
      THEME_VARIABLES[cssVar].resolvedColor = toHex(color);
    }
    THEME_VARIABLES[cssVar].css = `#{${scssVariable}}`;
  });

// resolve CSS variables to HEX
const cssColorVarMap = Object.fromEntries(
  Object.entries(THEME_VARIABLES).map(([k, v]) => [
    k,
    v.resolvedColor || v.value,
  ]),
);
Object.entries(THEME_VARIABLES)
  .filter(([_, { scssVariable }]) => !scssVariable)
  .forEach(([cssVar, { css: value }]) => {
    try {
      const resolvedValue = resolveCssVariables(value, cssColorVarMap);
      const resolvedColor = colorMixToHex(resolvedValue);
      THEME_VARIABLES[cssVar].resolvedColor = resolvedColor;
    } catch (e) {
      console.warn(`Could not resolve color-mix for ${cssVar}: ${e.message}`);
    }
  });

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
for (const [cssVar, { resolvedColor }] of Object.entries(THEME_VARIABLES)) {
  if (!resolvedColor) continue;
  const colorPattern = new RegExp(`${resolvedColor}(?![0-9a-fA-F])`, "g");
  content = content.replace(colorPattern, `var(${cssVar})`);
}

// Compose output
const headerPart =
  "// This theme file was generated in 00_srf-news-sandbox\n@use '@Styles/newsColors' as *;\n\n";
const { rootVars, darkVars } = themeVariablesToCss(THEME_VARIABLES);

const remainingColors = content.match(/#([0-9a-fA-F]{1,8})\b/g);
if (remainingColors) {
  console.log(
    "Remaining hardcoded colors:",
    [...new Set(remainingColors)].map((c) => [
      c,
      varColorLookup[c] || "unknown color",
    ]),
  );
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
