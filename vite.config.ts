import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";
import viteImagemin from 'vite-plugin-imagemin';



export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    viteImagemin({
      gifsicle: { optimizationLevel: 7, interlaced: false },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9], speed: 4 },
      svgo: {
        plugins: [
          { name: 'removeViewBox' },
          { name: 'removeEmptyAttrs', active: false },
        ],
      },
      webp: { quality: 75 },
    }),

    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for React and routing
          'vendor': ['react', 'react-dom', 'wouter'],

          // UI components (Radix UI + icons)
          'ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
            'lucide-react',
            'cmdk',
          ],

          // Data fetching
          'query': ['@tanstack/react-query'],

          // Form handling and validation
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod', 'zod-validation-error'],

          // State management
          'state': ['zustand', 'react-use'],

          // Charts (admin only - extracted to reduce initial load)
          'charts': ['recharts'],

          // PDF generation (billing only)
          'pdf': ['jspdf', 'html2canvas'],

          // Maps (location picker only)
          'maps': ['leaflet', 'react-leaflet'],

          // Date utilities
          'date-fns': ['date-fns'],

          // Animation
          'animation': ['framer-motion', 'motion'],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    // When Vite runs in Express middleware mode (see `server/vite.ts`),
    // it still needs to know which port the HMR websocket client should use.
    port: Number(process.env.PORT || 5000),
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["../tests/setup/vitest.setup.ts"],
    include: ["../tests/unit/**/*.test.ts", "../tests/unit/**/*.test.tsx"],
    css: true,
  },
});
