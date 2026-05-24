# ProPresenter clicker

A lightweight vibe-coded web app for remote clicking of selected ProPresenter presentation because hardware clickers are too lame. An admin selects and locks a presentation; the speaker views slide thumbnails on their phone and triggers slides over the local network.

## Routes

- `/` — Speaker view (slide thumbnails, next/previous, no auth)
- `/admin` — Admin panel (PIN-protected; pick a presentation to lock)
- `/dashboard` — Read-only status view

## Requirements

- ProPresenter 7 with **Network → Enable Network** turned on
- Node.js 22+ (only for local dev; Docker is self-contained)
- All devices on the same LAN as the ProPresenter machine

## ProPresenter version & protocol

ProPresenter 7.9+ exposes a REST API; earlier versions (7.0–7.8) only expose a WebSocket remote-control protocol. The app supports both:

- `PROPRESENTER_PROTOCOL=ws` (default) — WebSocket, works with **all 7.x versions**. Requires the network password set in ProPresenter Preferences.
- `PROPRESENTER_PROTOCOL=rest` — HTTP REST, **ProPresenter 7.9+ only**.

## Configuration

Create `.env` in the project root:

```
PROPRESENTER_HOST=localhost      # or host.docker.internal when running in Docker
PROPRESENTER_PORT=56650          # match your ProPresenter network port
PROPRESENTER_PROTOCOL=ws         # ws (default, all versions) | rest (7.9+ only)
PROPRESENTER_PASSWORD=           # required for ws mode; set in ProPresenter Network prefs
ADMIN_PIN=1234
APP_PORT=3000
```

## Run with Docker (recommended)

```bash
docker compose up --build
```

Open http://localhost:3000. The compose file overrides `PROPRESENTER_HOST` to `host.docker.internal` so the container can reach ProPresenter running on the host (works on macOS, Windows, and Linux via `host-gateway`).

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
- **Auth failure in ws mode** — `PROPRESENTER_PASSWORD` must match the password set in ProPresenter → Preferences → Network.
- **Every REST call 404s** — you're on ProPresenter < 7.9. Switch `PROPRESENTER_PROTOCOL=ws`.
- **Admin login fails** — `ADMIN_PIN` mismatch between client and server `.env`.
- **`/api/health`** returns `{"pp": true}` when the server can reach ProPresenter — a quick sanity check.
