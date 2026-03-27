import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const expressPort = Number(process.env.PORT || "5000");
  const serverOptions = {
    middlewareMode: true,
    // When running Vite as Express middleware, ensure Vite doesn't default
    // its internal HMR port to 5173 (which breaks the websocket client).
    port: expressPort,
    hmr: {
      server,
      path: "/vite-hmr",
      // When serving Vite via Express middleware, the websocket client must connect
      // back to the same port the browser is hitting (your Express PORT).
      clientPort: expressPort,
      port: expressPort,
      protocol: "ws",
    },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use(async (req, res, next) => {
    const url = req.originalUrl;

    // IMPORTANT: This catch-all exists to serve `index.html` for SPA navigations.
    // It must NOT intercept non-HTML requests (API routes, uploads, websocket upgrade
    // endpoints, etc.), otherwise it can break HMR and image/API requests.
    const accept = req.headers.accept || "";
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!accept.includes("text/html")) return next();

    if (
      url.startsWith("/api/") ||
      url.startsWith("/uploads") ||
      url.startsWith("/ws/") ||
      url.startsWith("/vite-hmr") ||
      url.startsWith("/@vite/") ||
      url.startsWith("/src/")
    ) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
