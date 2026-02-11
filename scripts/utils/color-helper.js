export function toHex(color) {
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
