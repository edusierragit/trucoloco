import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // base relativa: el build corre igual en GitHub Pages (/trucoloco/) que local
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173
  }
});
