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
  "--t-news-card-bg": "$warmgrey-1100",
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

// Evaluate the provided JS code in the page context
let content = await page.evaluate(() => {
  function toHex(color) {
    // Remove whitespace
    color = color.trim();
    // Hex already
    if (/^#([0-9a-f]{3,8})$/i.test(color)) return color;
    // rgb/rgba
    let rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
      let [r, g, b, a] = rgbMatch[1].split(",").map((x) => x.trim());
      r = parseInt(r, 10);
      g = parseInt(g, 10);
      b = parseInt(b, 10);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return color;
      if (typeof a !== "undefined") {
        a = Math.round(parseFloat(a) * 255);
        if (!isNaN(a) && a < 255) {
          return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}${a.toString(16).padStart(2, "0")}`;
        }
      }
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    // hsl/hsla
    let hslMatch = color.match(/^hsla?\(([^)]+)\)$/i);
    if (hslMatch) {
      let [h, s, l, a] = hslMatch[1].split(",").map((x) => x.trim());
      h = parseFloat(h);
      s = parseFloat(s) / 100;
      l = parseFloat(l) / 100;
      if (isNaN(h) || isNaN(s) || isNaN(l)) return color;
      let c = (1 - Math.abs(2 * l - 1)) * s;
      let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      let m = l - c / 2;
      let r1, g1, b1;
      if (h < 60) {
        r1 = c;
        g1 = x;
        b1 = 0;
      } else if (h < 120) {
        r1 = x;
        g1 = c;
        b1 = 0;
      } else if (h < 180) {
        r1 = 0;
        g1 = c;
        b1 = x;
      } else if (h < 240) {
        r1 = 0;
        g1 = x;
        b1 = c;
      } else if (h < 300) {
        r1 = x;
        g1 = 0;
        b1 = c;
      } else {
        r1 = c;
        g1 = 0;
        b1 = x;
      }
      let r = Math.round((r1 + m) * 255);
      let g = Math.round((g1 + m) * 255);
      let b = Math.round((b1 + m) * 255);
      if (typeof a !== "undefined") {
        a = Math.round(parseFloat(a) * 255);
        if (!isNaN(a) && a < 255) {
          return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}${a.toString(16).padStart(2, "0")}`;
        }
      }
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    // Named colors
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    let hex = ctx.fillStyle;
    if (/^#([0-9a-f]{3,8})$/i.test(hex)) return hex;
    return color;
  }

  // Function to check if a media query is for dark mode
  function isDarkModeMedia(mediaText) {
    return (
      mediaText &&
      mediaText.toLowerCase().includes("prefers-color-scheme") &&
      mediaText.toLowerCase().includes("dark")
    );
  }

  // Function to extract rules from a CSS rule
  function extractRules(rule, parentMedia = "") {
    const ruleInfo = {
      media: parentMedia,
      selector: "",
      styles: {},
      cssText: "",
    };

    if (rule.selectorText) {
      ruleInfo.selector = rule.selectorText;
      ruleInfo.cssText = rule.cssText;

      // Extract individual style properties
      if (rule.style) {
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          ruleInfo.styles[prop] = rule.style.getPropertyValue(prop);
        }
      }

      return ruleInfo;
    }

    return null;
  }

  function toCSS(rule, omitSelector = false) {
    let css = "";
    if (!omitSelector) {
      css += `${rule.selector} {\n`;
    }
    for (const prop in rule.styles) {
      let value = rule.styles[prop];
      // Only convert if value looks like a color (not 'none', 'inherit', etc.)
      const colorLike =
        /^(#([0-9a-f]{3,8})|rgb\s*\(.*\)|rgba\s*\(.*\)|hsl\s*\(.*\)|hsla\s*\(.*\)|[a-zA-Z]+)$/i;
      const nonColors = /^(none|inherit|initial|unset|transparent)$/i;
      if (colorLike.test(value.trim()) && !nonColors.test(value.trim())) {
        // console.log(`Converting color value: ${value}`);
        value = toHex(value);
      }
      css += `  ${prop}: ${value};\n`;
    }
    if (!omitSelector) {
      css += "}\n";
    }
    return css;
  }

  // Custom sort: :root first, then elements, then classes
  function selectorRank(sel) {
    if (sel.startsWith(":root")) return 0;
    if (/^\#[\w-]/.test(sel)) return 2; // id selectors
    if (/^\.[\w-]/.test(sel)) return 3; // class selectors
    return 1; // element selectors
  }

  const darkModeRules = [];

  // Iterate through all stylesheets
  console.log("🔍 Scanning stylesheets for dark mode rules...\n");
  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules;
        if (!rules) continue;

        const sheetHref = sheet.href || "inline-style";
        let foundInSheet = false;

        // return "FOUND" + rules.length; // --- IGNORE ---
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];

          // Check if this is a media rule
          if (
            rule.type === CSSRule.MEDIA_RULE &&
            isDarkModeMedia(rule.media.mediaText)
          ) {
            if (!foundInSheet) {
              console.log(`\n📄 Stylesheet: ${sheetHref}`);
              foundInSheet = true;
            }

            console.log(`\n  📱 Media Query: ${rule.media.mediaText}`);

            // Extract all rules within this media query
            const mediaRules = rule.cssRules || rule.rules;
            if (mediaRules) {
              for (let k = 0; k < mediaRules.length; k++) {
                const innerRule = mediaRules[k];

                // Handle nested rules (like @supports within @media)
                if (
                  innerRule.type === CSSRule.SUPPORTS_RULE ||
                  innerRule.type === CSSRule.MEDIA_RULE
                ) {
                  const nestedRules = innerRule.cssRules || innerRule.rules;
                  if (nestedRules) {
                    for (let l = 0; l < nestedRules.length; l++) {
                      const ruleInfo = extractRules(
                        nestedRules[l],
                        rule.media.mediaText,
                      );
                      if (ruleInfo) {
                        darkModeRules.push({
                          ...ruleInfo,
                          stylesheet: sheetHref,
                          nested: innerRule.cssText.substring(0, 50) + "...",
                        });
                      }
                    }
                  }
                } else {
                  const ruleInfo = extractRules(
                    innerRule,
                    rule.media.mediaText,
                  );
                  if (ruleInfo) {
                    darkModeRules.push({
                      ...ruleInfo,
                      stylesheet: sheetHref,
                    });
                    console.log(`    ✓ ${ruleInfo.selector}`);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // CORS or other errors accessing external stylesheets
        console.warn(
          `⚠️  Could not access stylesheet: ${sheet.href || "inline"}`,
          e.message,
        );
      }
    }

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

      const sortedSelectors = Object.keys(mergedBySelector).sort((a, b) => {
        const rankA = selectorRank(a);
        const rankB = selectorRank(b);
        if (rankA !== rankB) return rankA - rankB;
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });

      stylesheetString += `body[data-theme] {\n`;

      stylesheetString += toCSS(
        { selector: ":root", styles: rootStyles },
        true,
      );

      stylesheetString += toCSS({ selector: "body", styles: bodyStyles }, true);
      // Output other selectors, excluding :root and body which are merged into the top-level

      sortedSelectors.forEach((selector) => {
        stylesheetString += toCSS(mergedBySelector[selector]);
      });
      stylesheetString += "}\n\n";
    });
    // Output stylesheet string
    console.log("\n🎨 Usable stylesheet string for dark mode:");
    console.log(stylesheetString);
    return stylesheetString;
  } catch (error) {
    console.error("❌ Error scanning stylesheets:", error);
    return "";
  }
}); // jsCode --- IGNORE ---

// Replace hardcoded color values in the content with CSS variables

for (const [color, cssVar] of Object.entries(colorToCssVar)) {
  const colorPattern = new RegExp(`${color}(?![0-9a-fA-F])`, "g");
  content = content.replace(colorPattern, `var(${cssVar})`);
}

// print out remaining color values that were not replaced (for debugging)
const remainingColors = content.match(/#([0-9a-fA-F]{1,8})\b/g);
if (remainingColors) {
  console.log("Remaining hardcoded colors:");
  console.log([...new Set(remainingColors)]);
} else {
  console.log("No remaining hardcoded colors found.");
}

await browser.close();

if (typeof content !== "string") {
  console.error("The JS code must return a string (the SCSS content)");
  process.exit(1);
}

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, content, { encoding: "utf8" });
console.log("Theme variables written to:", outputFile);
