function parseHex(color) {
  if (/^#([0-9a-f]{8})$/i.test(color)) return color.toLowerCase();
  if (/^#([0-9a-f]{3})$/i.test(color)) {
    // Expand 3-digit hex to 8-digit (with ff alpha)
    const hex = color
      .substring(1)
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${hex}ff`;
  }
  if (/^#([0-9a-f]{6})$/i.test(color)) {
    // Add ff alpha
    return color.toLowerCase() + "ff";
  }
  return null;
}

function parseRgb(color) {
  // rgb() or rgba() with commas: rgb(20, 20, 17) or rgba(20, 20, 17, 1)
  let rgbMatch = color.match(
    /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i,
  );
  if (rgbMatch) {
    const [r, g, b] = rgbMatch.slice(1, 4).map(Number);
    return [r, g, b, 255];
  }
  let rgbaMatch = color.match(
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
  );
  if (rgbaMatch) {
    const [r, g, b] = rgbaMatch.slice(1, 4).map(Number);
    let a = Math.round(parseFloat(rgbaMatch[4]) * 255);
    if (isNaN(a)) a = 255;
    return [r, g, b, a];
  }
  // rgb() or rgba() with spaces and optional slash: rgb(20 20 17 / 1) or rgba(20 20 17 / 1)
  let rgbSpaceMatch = color.match(
    /^rgb\s*\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*(\d*\.?\d+)\s*)?\)$/i,
  );
  if (rgbSpaceMatch) {
    const [r, g, b] = rgbSpaceMatch.slice(1, 4).map(Number);
    let a = 255;
    if (rgbSpaceMatch[4]) {
      a = Math.round(parseFloat(rgbSpaceMatch[4]) * 255);
      if (isNaN(a)) a = 255;
    }
    return [r, g, b, a];
  }
  let rgbaSpaceMatch = color.match(
    /^rgba\s*\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*(\d*\.?\d+)\s*\)$/i,
  );
  if (rgbaSpaceMatch) {
    const [r, g, b] = rgbaSpaceMatch.slice(1, 4).map(Number);
    let a = Math.round(parseFloat(rgbaSpaceMatch[4]) * 255);
    if (isNaN(a)) a = 255;
    return [r, g, b, a];
  }
  return null;
}

function parseHsl(color) {
  // hsl(210, 50%, 60%) or hsla(210, 50%, 60%, 0.5)
  let hslMatch = color.match(
    /^hsl\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/i,
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    return [...hslToRgb(h, s, l), 255];
  }
  let hslaMatch = color.match(
    /^hsla\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
  );
  if (hslaMatch) {
    const h = parseFloat(hslaMatch[1]);
    const s = parseFloat(hslaMatch[2]) / 100;
    const l = parseFloat(hslaMatch[3]) / 100;
    let a = Math.round(parseFloat(hslaMatch[4]) * 255);
    if (isNaN(a)) a = 255;
    return [...hslToRgb(h, s, l), a];
  }
  return null;
}

function hslToRgb(h, s, l) {
  // h in [0, 360], s and l in [0, 1]
  h = ((h % 360) + 360) % 360; // wrap hue
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
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

export function toHex(color) {
  color = color.trim();
  let hex = parseHex(color);
  if (hex) return hex;
  let rgb = parseRgb(color);
  if (rgb) {
    return "#" + rgb.map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  let hsl = parseHsl(color);
  if (hsl) {
    return "#" + hsl.map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return color;
}
