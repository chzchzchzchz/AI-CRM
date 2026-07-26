import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // The markdown/diagram renderer is code-split at its component (see
    // SafeStreamdown) and lands in its own chunks, so the remaining warning
    // threshold only needs to cover the app + framework chunks.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /**
         * Split dependencies that change on a different cadence than our code.
         * A one-line UI fix should not force every visitor to re-download
         * React and Radix; keeping them in stable chunks means their hashes
         * survive across deploys and stay cached.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("lucide-react")) {
            return "vendor-ui";
          }
          if (id.includes("@trpc") || id.includes("@tanstack") || id.includes("superjson")) {
            return "vendor-data";
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    },
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
