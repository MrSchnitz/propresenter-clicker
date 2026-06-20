import { resolvePpHost } from "./ppHost.js";

function getBaseUrl() {
  const host = resolvePpHost();
  const port = process.env.PROPRESENTER_PORT || "50001";
  return `http://${host}:${port}`;
}

async function apiGet(path: string): Promise<Response> {
  return fetch(`${getBaseUrl()}${path}`);
}

// Library & Playlists

export async function getPlaylists() {
  const res = await apiGet("/v1/playlists");
  return res.json();
}

export async function getPlaylist(id: string) {
  const res = await apiGet(`/v1/playlist/${encodeURIComponent(id)}`);
  return res.json();
}

export async function getLibraries() {
  const res = await apiGet("/v1/libraries");
  return res.json();
}

export async function getLibrary(id: string) {
  const res = await apiGet(`/v1/library/${encodeURIComponent(id)}`);
  return res.json();
}

// Presentations

export async function getPresentation(uuid: string) {
  const res = await apiGet(`/v1/presentation/${encodeURIComponent(uuid)}`);
  return res.json();
}

// Slide thumbnails

export async function getSlideThumb(
  uuid: string,
  slideIndex: number,
  quality = 400
): Promise<Response> {
  return apiGet(
    `/v1/presentation/${encodeURIComponent(uuid)}/thumbnail/${slideIndex}?quality=${quality}`
  );
}

// Slide triggering

export async function triggerSlide(uuid: string, slideIndex: number) {
  await apiGet(
    `/v1/presentation/${encodeURIComponent(uuid)}/trigger/${slideIndex}`
  );
  return { ok: true };
}

// "Clear All": ProPresenter 7's REST API has no single clear-all endpoint, so we
// clear each output layer (GET /v1/clear/layer/{layer}). This mirrors pressing
// "Clear All" in ProPresenter — the screen goes blank.
const CLEAR_LAYERS = [
  "slide",
  "media",
  "video_input",
  "props",
  "messages",
  "announcements",
  "audio",
] as const;

export async function clear() {
  await Promise.all(
    CLEAR_LAYERS.map((layer) => apiGet(`/v1/clear/layer/${layer}`))
  );
  return { ok: true };
}

// Status

// ProPresenter 7's REST API exposes the current slide index under
// /v1/presentation/slide_index as { presentation_index: { index, presentation_id } }.
// The frontend wants { slide_index, presentation_id }; presentation_id lets the
// speaker view highlight the active slide in the correct presentation.
export async function getCurrentSlide() {
  const res = await apiGet("/v1/presentation/slide_index");
  if (!res.ok) return {};
  const data = await res.json();
  const idx = data?.presentation_index?.index;
  // presentation_id is usually an object { uuid, name, index } in PP7, but some
  // versions return a bare string — normalize to the uuid string either way.
  const pid = data?.presentation_index?.presentation_id;
  const presentationId = typeof pid === "string" ? pid : pid?.uuid;
  // Leave slide_index undefined when ProPresenter has no active slide so the
  // frontend keeps its current highlight instead of jumping to slide 0.
  return typeof idx === "number"
    ? { slide_index: idx, presentation_id: presentationId }
    : {};
}
