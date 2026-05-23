# ProPresenter Remote

A lightweight web app for remote clicking of selected ProPresenter presentation because hardware clickers are too lame. An admin selects and locks a presentation; the speaker views slide thumbnails on their phone and triggers slides over the local network.

## Routes

- `/` — Speaker view (slide thumbnails, next/previous, no auth)
- `/admin` — Admin panel (PIN-protected; pick a presentation to lock)
- `/dashboard` — Read-only status view

## Requirements

- ProPresenter 7 with **Network → Enable Network** turned on
- Node.js 22+ (only for local dev; Docker is self-contained)
- All devices on the same LAN as the ProPresenter machine

## Configuration

Create `.env` in the project root:

```
PROPRESENTER_HOST=localhost      # or host.docker.internal when running in Docker
PROPRESENTER_PORT=56650          # match your ProPresenter network port
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

## Desktop build (Tauri)

```bash
npm run tauri:dev      # dev window
npm run tauri:build    # bundled app
```

## Troubleshooting

- **502 "Cannot reach ProPresenter"** — the server can't talk to ProPresenter. Check that ProPresenter's network API is enabled, the port matches, and (in Docker) `PROPRESENTER_HOST=host.docker.internal`.
- **Admin login fails** — `ADMIN_PIN` mismatch between client and server `.env`.
- **`/api/health`** returns `{"pp": true}` when the server can reach ProPresenter — a quick sanity check.
