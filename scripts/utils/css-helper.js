// Function to check if a media query is for dark mode
export function isDarkModeMedia(mediaText) {
  return (
    mediaText &&
    mediaText.toLowerCase().includes("prefers-color-scheme") &&
    mediaText.toLowerCase().includes("dark")
  );
}

// Function to extract rules from a CSS rule
export function extractRules(rule, parentMedia = "") {
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

// Convert CSS rule to definition string
export function toCSS(rule, omitSelector = false) {
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

// Convert CSS theme variables to definition string
export function themeVariablesToCss(
  themeVariables,
  writeDarkDefinitions = false,
) {
  let darkVars = "";
  if (!writeDarkDefinitions) {
    darkVars += "\n\n/*** color values used\n";
  }
  let rootVars = ":root {\n";
  darkVars += "\n[data-theme='dark'] {\n";
  for (const [cssVar, value] of Object.entries(themeVariables)) {
    const { scssVariable, css, ignoreInCustomTheme } = value;
    const defaultValue = ignoreInCustomTheme ? css : "unset";
    rootVars += `  ${cssVar}: ${defaultValue};\n`;
    if (!ignoreInCustomTheme) {
      darkVars += `  ${cssVar}: #{${scssVariable}};\n`;
    }
  }
  rootVars += "}\n";
  darkVars += "}\n\n";
  if (!writeDarkDefinitions) {
    darkVars += "***/\n\n";
  }
  return { rootVars, darkVars };
}

// Custom sort: :root first, then elements, then classes
export function selectorRank(sel) {
  if (sel.startsWith(":root")) return 0;
  if (/^\#[\w-]/.test(sel)) return 2; // id selectors
  if (/^\.[\w-]/.test(sel)) return 3; // class selectors
  return 1; // element selectors
}

export function collectDocumentsDarkModeRules() {
  const darkModeRules = [];
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i];

    try {
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;

      const sheetHref = sheet.href || "inline-style";
      let foundInSheet = false;

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
                const ruleInfo = extractRules(innerRule, rule.media.mediaText);
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
  return darkModeRules;
}

// Resolve CSS variables in a value using a provided map of variable names to values
export function resolveCssVariables(value, varMap) {
  return value.replace(/var\((--[\w-]+)\)/g, (_, cssVar) => {
    const resolved = varMap[cssVar];
    if (!resolved) throw new Error(`Variable ${cssVar} not found in varMap`);
    return resolved;
  });
}
