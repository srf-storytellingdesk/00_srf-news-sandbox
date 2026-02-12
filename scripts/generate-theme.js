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

const url =
  process.argv[2] ||
  "https://www.srf.ch/news/dialog/fehlende-berichterstattung-humanitaere-krisen-ohne-aufmerksamkeit";
// const jsCodeFile =
//   process.argv[3] || "scripts/assets/parse-darktheme-overrides.js";
const outputFile = path.resolve("theme-override/themeVariables.scss");

if (!url) {
  console.error("Usage: node scripts/fetch-theme-vars.js <URL> <JS_CODE_FILE>");
  process.exit(1);
}

// 1. Parse _newsColors.scss to get color values for each SCSS variable
const scss = await fs.readFile(colorsFile, "utf8");
const varToColor = {};
const varRegex = /\$(\w[\w-]*):\s*([^;]+);/g;
let match;
while ((match = varRegex.exec(scss))) {
  varToColor[`$${match[1]}`] = match[2].trim();
}

// 2. Build a color value to CSS variable map
const colorToCssVar = {};

for (const [cssVar, scssVar] of Object.entries(mapping)) {
  let color = varToColor[scssVar];
  if (color) {
    const hexColor = toHex(color);
    colorToCssVar[hexColor] = cssVar;
  } else {
    console.warn(`No color found for ${scssVar}`);
  }
}

// const jsCode = await fs.readFile(jsCodeFile, "utf8");

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle2" });

async function loadHelperScript(scriptPath) {
  // add a script tag to the page as a module
  let code = await fs.readFile(path.resolve(__dirname, scriptPath), "utf8");
  // replace export with window assignment to make functions available in the page context
  code = code.replace(/export function (\w+)/g, "window.$1 = function $1");
  await page.addScriptTag({
    content: code,
  });
}

await loadHelperScript("./utils/color-helper.js");
await loadHelperScript("./utils/css-helper.js");

// Call the helper function from the module script inside evaluate
let content = await page.evaluate(async () => {
  //   Wait for the module to be loaded and attached to window (if you modify the helper to do so)
  if (typeof window.isDarkModeMedia !== "function") {
    // Wait a tick for the module to attach
    await new Promise((r) => setTimeout(r, 4000));
  }
  if (typeof window.isDarkModeMedia !== "function") {
    throw new Error(
      "window.isDarkModeMedia is not available. Make sure color-helper.js attaches it to window.",
    );
  }

  let darkModeRules;

  // Iterate through all stylesheets
  console.log("🔍 Scanning stylesheets for dark mode rules...\n");
  try {
    darkModeRules = collectDocumentsDarkModeRules();

    // Group by selector for easier analysis
    const groupedBySelector = {};
    darkModeRules.forEach((rule) => {
      if (!groupedBySelector[rule.selector]) {
        groupedBySelector[rule.selector] = [];
      }
      groupedBySelector[rule.selector].push(rule);
    });

    // Generate stylesheet string for dark mode
    // Convert color values to hex if possible

    let stylesheetString = "";
    // Group by media query
    const mediaGroups = {};
    darkModeRules.forEach((rule) => {
      if (!mediaGroups[rule.media]) mediaGroups[rule.media] = [];
      mediaGroups[rule.media].push(rule);
    });

    Object.keys(mediaGroups).forEach((media) => {
      // Sort rules by selector alphabetically
      // Merge styles for selectors with the same name
      const mergedBySelector = {};
      mediaGroups[media].forEach((rule) => {
        if (!mergedBySelector[rule.selector]) {
          mergedBySelector[rule.selector] = {
            ...rule,
            styles: { ...rule.styles },
          };
        } else {
          // Merge styles (later rules override earlier ones)
          Object.assign(mergedBySelector[rule.selector].styles, rule.styles);
        }
      });

      // Extract and merge :root and body styles
      const rootStyles = mergedBySelector[":root"]
        ? { ...mergedBySelector[":root"].styles }
        : {};
      const bodyStyles = mergedBySelector["body"]
        ? { ...mergedBySelector["body"].styles }
        : {};

      // Remove :root and body from output
      delete mergedBySelector[":root"];
      delete mergedBySelector["body"];

      // sort selectors
      const sortedSelectors = Object.keys(mergedBySelector).sort((a, b) => {
        const rankA = selectorRank(a);
        const rankB = selectorRank(b);
        if (rankA !== rankB) return rankA - rankB;
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });

      // stringify CSS rules
      stylesheetString += `body[data-theme] {\n`;
      stylesheetString += toCSS(
        { selector: ":root", styles: rootStyles },
        true,
      );
      stylesheetString += toCSS({ selector: "body", styles: bodyStyles }, true);
      sortedSelectors.forEach((selector) => {
        stylesheetString += toCSS(mergedBySelector[selector]);
      });
      stylesheetString += "}\n\n";
    });
    // Output stylesheet string
    // console.log("\n🎨 Usable stylesheet string for dark mode:");
    // console.log(stylesheetString);
    return stylesheetString;
  } catch (error) {
    console.error("❌ Error scanning stylesheets:", error);
    return "";
  }
});
await browser.close();

// Replace hardcoded color values in the content with CSS variables
for (const [color, cssVar] of Object.entries(colorToCssVar)) {
  const hexColor = toHex(color);
  const colorPattern = new RegExp(`${hexColor}(?![0-9a-fA-F])`, "g");
  content = content.replace(colorPattern, `var(${cssVar})`);
}

// add header part
let headerPart = "// This theme file was generated in 00_srf-news-sandbox\n";
headerPart += "@use '@Styles/newsColors' as *;\n\n";

const allowValue = ["--t-news-black", "--t-news-white"];

// add default theme variables
let defaultThemeVars = "";
defaultThemeVars += ":root {\n";
for (const [cssVar, color] of Object.entries(mapping)) {
  const defaultValue = allowValue.includes(cssVar) ? `#{${color}}` : "unset";
  defaultThemeVars += `  ${cssVar}: ${defaultValue};\n`;
}
defaultThemeVars += "}\n";

// add dark theme variables
let darkThemeVars = "\n[data-theme='dark'] {\n";
for (const [cssVar, color] of Object.entries(mapping)) {
  if (allowValue.includes(cssVar)) continue;
  darkThemeVars += `  ${cssVar}: #{${color}};\n`;
}
darkThemeVars += "}\n\n";

// print out remaining color values that were not replaced (for debugging)
const remainingColors = content.match(/#([0-9a-fA-F]{1,8})\b/g);
if (remainingColors) {
  console.log("Remaining hardcoded colors:");
  console.log([...new Set(remainingColors)]);
} else {
  console.log("No remaining hardcoded colors found.");
}

if (typeof content !== "string") {
  console.error("The JS code must return a string (the SCSS content)");
  process.exit(1);
}

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(
  outputFile,
  headerPart + defaultThemeVars + darkThemeVars + content,
  { encoding: "utf8" },
);
console.log("Theme variables written to:", outputFile);
