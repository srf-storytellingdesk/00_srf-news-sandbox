import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHtmlPlugin } from "vite-plugin-html";

export default defineConfig({
  base: "/widgets/sandbox", // adjust if your widget will be served from a different subpath
  test: {
    globals: true,
    environment: "node",
    include: ["../scripts/**/*.{test,spec}.{js,mjs,ts,tsx,jsx}"],
  },
  plugins: [
    react(),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          title: "SRF News Sandbox",
          id: "srf-news-sandbox",
        },
      },
    }),
  ],
  root: "template",
  // you’ll serve downloaded CMS assets from /public/cms/...
  publicDir: "public",
});
