// Build de demonstração: um único HTML (sem PWA), para abrir como página de teste.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { "virtual:pwa-register": path.resolve(__dirname, "src/pwa-stub.ts") } },
  build: { outDir: "dist-single" },
});
