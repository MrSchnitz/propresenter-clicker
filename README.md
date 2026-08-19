# ProPresenter clicker

A lightweight vibe-coded web app for remote clicking of selected ProPresenter presentation because hardware clickers are too lame. An admin selects and locks a presentation; the speaker views slide thumbnails on their phone and triggers slides over the local network.

## Routes

- `/` — Speaker view (slide thumbnails, next/previous; optional speaker PIN)
- `/admin` — Admin panel (PIN-protected; pick presentations, manage connection settings and PINs)

## Requirements

- ProPresenter 7 with **Network → Enable Network** turned on
- Node.js 22+ (only for local dev; Docker is self-contained)
- All devices on the same LAN as the ProPresenter machine

## ProPresenter version & protocol

ProPresenter 7.9+ exposes a REST API; earlier versions (7.0–7.8) only expose a WebSocket remote-control protocol. The app supports both:

- `PROPRESENTER_PROTOCOL=ws` (default) — WebSocket, works with **all 7.x versions**. Requires the network password set in ProPresenter Preferences.
- `PROPRESENTER_PROTOCOL=rest` — HTTP REST, **ProPresenter 7.9+ only**.

## Configuration

Most settings are editable at runtime in the admin panel (`/admin`):

- **ProPresenter connection** — host, port, protocol (ws/rest), and password (ws mode only; the REST API has no auth). Changes apply immediately, no restart needed.
- **Admin PIN** and **Speaker PIN** — each in its own section.

Saved settings are persisted to `data/settings.json` and survive restarts.

`.env` in the project root provides the startup config (see `.env.example`):

```
# Required (changing it needs a restart)
APP_PORT=3000

# First-run defaults — used until settings are saved in the admin panel;
# after that, data/settings.json takes precedence on every startup.
PROPRESENTER_HOST=localhost      # or a LAN IP; auto-mapped to the host in Docker
PROPRESENTER_PORT=56650          # match your ProPresenter network port
PROPRESENTER_PROTOCOL=ws         # ws (default, all versions) | rest (7.9+ only)
PROPRESENTER_PASSWORD=           # ws mode only; set in ProPresenter Network prefs
ADMIN_PIN=1234
```

To make `.env` authoritative again, delete `data/settings.json` and restart.

## Run with Docker (recommended)

```bash
docker compose up --build
```

Open http://localhost:3000. A `PROPRESENTER_HOST` of `localhost` is automatically rewritten to `host.docker.internal` inside the container, so the same `.env` works with ProPresenter running on the host (macOS, Windows, and Linux via `host-gateway`).

The compose file mounts `./data`, so settings saved in the admin panel survive container restarts and rebuilds.

Stop with `docker compose down`.

## Run locally (no Docker)

```bash
npm install
npm run dev        # vite + server with hot reload
# or
npm run build && npm start
```

## Troubleshooting

- **502 "Cannot reach ProPresenter"** — the server can't talk to ProPresenter. Check that ProPresenter's network API is enabled, the port matches, and (in Docker) `PROPRESENTER_HOST=host.docker.internal`.
- **Auth failure in ws mode** — the password must match the one set in ProPresenter → Preferences → Network.
- **Every REST call 404s** — you're on ProPresenter < 7.9. Switch the protocol to `ws` in the admin panel.
- **Admin login fails** — the PIN may have been changed in the admin panel; the current one lives in `data/settings.json`, not `.env`.
- **`.env` changes seem ignored** — once settings are saved in the admin panel, `data/settings.json` overrides `.env`. Delete it and restart to fall back to `.env`.
- **`/api/health`** returns `{"pp": true}` when the server can reach ProPresenter — a quick sanity check.
