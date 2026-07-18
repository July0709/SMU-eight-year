import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const siteRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./static-site", import.meta.url)),
  base: "/SMU-eight-year/",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./github-pages-dist", import.meta.url)),
    // Local preview servers can hold built assets open on Windows; CI always starts
    // from a clean checkout and may safely clear the deployment directory.
    emptyOutDir: process.env.CI === "true",
  },
  cacheDir: `${siteRoot}/node_modules/.vite-pages`,
});
