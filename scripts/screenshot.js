import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCREENSHOTS_DIR = path.join(ROOT, "screenshots");
const VITE_BASE = "/widgets/sandbox/";

const configName = process.argv[2] || "srf";

function startVite() {
  return new Promise((resolve, reject) => {
    const proc = spawn("pnpm", ["dev", configName], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const onData = (data) => {
      const match = data.toString().match(/localhost:(\d+)/);
      if (match && !resolved) {
        resolved = true;
        resolve({ proc, url: `http://localhost:${match[1]}${VITE_BASE}` });
      }
    };

    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("error", reject);
    setTimeout(() => {
      if (!resolved) reject(new Error("Vite startup timeout"));
    }, 20000);
  });
}

await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

console.log("Starting Vite...");
const { proc: viteProc, url } = await startVite();
console.log(`Vite ready at ${url}`);

const browser = await puppeteer.launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

  await page.waitForSelector('[data-news-landmark="news-loading-screen"]', {
    hidden: true,
    timeout: 30000,
  });

  const contentHeight = await page.evaluate(() => {
    document
      .querySelectorAll('[data-news-landmark="news-loading-screen"]')
      .forEach((el) => el.remove());

    for (const el of [document.documentElement, document.body]) {
      el.style.overflow = "visible";
      el.style.height = "auto";
    }

    // Only unlock elements taller than the viewport — those are page-level
    // scroll containers (e.g. Nuxt's #__nuxt wrapper). Smaller elements like
    // nav menus and icon containers must not be touched.
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      if (
        el.scrollHeight > window.innerHeight * 1.2 &&
        (s.overflowY === "auto" ||
          s.overflowY === "scroll" ||
          s.overflowY === "hidden")
      ) {
        el.style.overflow = "visible";
        el.style.height = "auto";
      }
    }

    return document.documentElement.scrollHeight;
  });

  await page.setViewport({ width: 1280, height: contentHeight });
  const outPath = path.join(SCREENSHOTS_DIR, `${configName}.png`);
  await page.screenshot({ path: outPath });
  await page.close();
  console.log(`Screenshot saved: screenshots/${configName}.png`);
} finally {
  await browser.close();
  viteProc.kill();
}

process.exit(0);
