import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIGS = ["srf", "rsi", "rtr", "rts", "swi"];

for (const config of CONFIGS) {
  execSync(
    `node ${path.join(__dirname, "generate-template.js")} ${config}`,
    { stdio: "inherit", cwd: ROOT },
  );
}

process.exit(0);
