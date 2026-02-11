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
      value = colorToHex(value);
    }
    css += `  ${prop}: ${value};\n`;
  }
  if (!omitSelector) {
    css += "}\n";
  }
  return css;
}
