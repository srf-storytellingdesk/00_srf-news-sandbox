import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "template",
  // you’ll serve downloaded CMS assets from /public/cms/...
  publicDir: "public",
});
