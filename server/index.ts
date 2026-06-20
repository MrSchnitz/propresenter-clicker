import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import routes from "./routes.js";

// Support CLI args as fallback: --port 3000 --pp-host localhost --pp-port 56650 --pin 1234
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

if (getArg("pp-host")) process.env.PROPRESENTER_HOST = getArg("pp-host");
if (getArg("pp-port")) process.env.PROPRESENTER_PORT = getArg("pp-port");
if (getArg("pin")) process.env.ADMIN_PIN = getArg("pin");

// Works in both ESM and CJS (pkg)
const __dirname =
  typeof __filename !== "undefined"
    ? path.dirname(__filename)
    : path.dirname(new URL(import.meta.url).pathname);
const app = express();
const PORT = parseInt(getArg("port") || process.env.APP_PORT || "3000", 10);

app.use(cors());
app.use(express.json());
app.use(routes);

// In production, serve the built frontend. In development, run Vite in
// middleware mode so the frontend (with HMR) and the API share APP_PORT.
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(
    `ProPresenter API: http://${process.env.PROPRESENTER_HOST}:${process.env.PROPRESENTER_PORT}`
  );
});
