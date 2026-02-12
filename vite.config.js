import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/widgets/sandbox", // adjust if your widget will be served from a different subpath
  plugins: [react()],
  root: "template",
  // you’ll serve downloaded CMS assets from /public/cms/...
  publicDir: "public",
});
