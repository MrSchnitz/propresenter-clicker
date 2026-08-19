import fs from "fs";
import path from "path";
import { resetConnection } from "./proPresenterWsApi.js";

// Runtime-editable settings, managed from the admin UI. process.env stays the
// single source of truth for the rest of the server (everything reads env
// lazily); this module overlays saved values onto env at boot and persists
// changes so they survive restarts. .env / CLI args act as first-run defaults —
// once something is saved from the admin UI, the saved value wins.
//
// appPort is persisted like the rest but only takes effect on the next start —
// the server is already listening by the time it could change.

export interface AppSettings {
  ppHost: string;
  ppPort: string;
  ppProtocol: "ws" | "rest";
  ppPassword: string;
  adminPin: string;
  appPort: string;
}

const DEFAULTS: AppSettings = {
  ppHost: "localhost",
  ppPort: "50001",
  ppProtocol: "ws",
  ppPassword: "",
  adminPin: "1234",
  appPort: "3000",
};

function settingsFile(): string {
  return (
    process.env.SETTINGS_FILE ||
    path.join(process.cwd(), "data", "settings.json")
  );
}

export function getSettings(): AppSettings {
  const env = process.env;
  return {
    ppHost: env.PROPRESENTER_HOST || DEFAULTS.ppHost,
    ppPort: env.PROPRESENTER_PORT || DEFAULTS.ppPort,
    ppProtocol:
      (env.PROPRESENTER_PROTOCOL || "").toLowerCase() === "rest" ? "rest" : "ws",
    ppPassword: env.PROPRESENTER_PASSWORD ?? DEFAULTS.ppPassword,
    adminPin: env.ADMIN_PIN || DEFAULTS.adminPin,
    appPort: env.APP_PORT || DEFAULTS.appPort,
  };
}

function applyToEnv(s: AppSettings): void {
  process.env.PROPRESENTER_HOST = s.ppHost;
  process.env.PROPRESENTER_PORT = s.ppPort;
  process.env.PROPRESENTER_PROTOCOL = s.ppProtocol;
  process.env.PROPRESENTER_PASSWORD = s.ppPassword;
  process.env.ADMIN_PIN = s.adminPin;
  process.env.APP_PORT = s.appPort;
}

// Called once at boot (after dotenv and CLI args): overlay whatever was saved
// from the admin UI, and materialize the effective values back into env so
// every consumer sees the same thing.
export function loadSettings(): void {
  const merged = getSettings();
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    for (const key of Object.keys(DEFAULTS) as (keyof AppSettings)[]) {
      if (typeof saved[key] === "string") {
        (merged as Record<keyof AppSettings, string>)[key] = saved[key];
      }
    }
    merged.ppProtocol = merged.ppProtocol === "rest" ? "rest" : "ws";
  } catch {
    /* no saved settings yet (or unreadable) — env/defaults apply */
  }
  applyToEnv(merged);
}

export interface UpdateResult {
  settings: AppSettings;
  // False when the settings file couldn't be written (e.g. read-only
  // container without a data volume) — changes still apply until restart.
  persisted: boolean;
}

export function updateSettings(patch: Partial<AppSettings>): UpdateResult {
  const current = getSettings();
  const next: AppSettings = { ...current };

  if (patch.ppHost !== undefined) {
    const host = String(patch.ppHost).trim();
    if (!host) throw new Error("Host must not be empty");
    next.ppHost = host;
  }
  if (patch.ppPort !== undefined) {
    const port = String(patch.ppPort).trim();
    if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) {
      throw new Error("Port must be a number between 1 and 65535");
    }
    next.ppPort = port;
  }
  if (patch.ppProtocol !== undefined) {
    if (patch.ppProtocol !== "ws" && patch.ppProtocol !== "rest") {
      throw new Error('Protocol must be "ws" or "rest"');
    }
    next.ppProtocol = patch.ppProtocol;
  }
  if (patch.ppPassword !== undefined) {
    next.ppPassword = String(patch.ppPassword);
  }
  if (patch.adminPin !== undefined) {
    const pin = String(patch.adminPin).trim();
    if (!pin) throw new Error("Admin PIN must not be empty");
    next.adminPin = pin;
  }
  if (patch.appPort !== undefined) {
    const port = String(patch.appPort).trim();
    if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) {
      throw new Error("App port must be a number between 1 and 65535");
    }
    // Persisted and applied on the next start; the running server keeps
    // listening on its current port.
    next.appPort = port;
  }

  applyToEnv(next);

  // The WS backend holds a persistent connection with the old config; drop it
  // (and its caches) so the next request reconnects fresh. The REST backend
  // reads env per call and needs nothing. Also reset when switching protocols,
  // so a stale WS connection doesn't linger after moving to REST.
  const connectionChanged = (
    ["ppHost", "ppPort", "ppProtocol", "ppPassword"] as const
  ).some((k) => next[k] !== current[k]);
  if (connectionChanged) resetConnection();

  let persisted = true;
  try {
    const file = settingsFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  } catch {
    persisted = false;
  }

  return { settings: next, persisted };
}
