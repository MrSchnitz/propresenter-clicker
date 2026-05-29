function getBaseUrl() {
  const host = process.env.PROPRESENTER_HOST || "localhost";
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

export async function triggerNext() {
  await apiGet("/v1/trigger/next");
  return { ok: true };
}

export async function triggerPrevious() {
  await apiGet("/v1/trigger/previous");
  return { ok: true };
}

// Status

// ProPresenter 7's REST API exposes the current slide index under
// /v1/presentation/slide_index as { presentation_index: { index, presentation_id } }.
// The frontend just wants { slide_index }, so translate here to match the WS API.
export async function getCurrentSlide() {
  const res = await apiGet("/v1/presentation/slide_index");
  if (!res.ok) return {};
  const data = await res.json();
  const idx = data?.presentation_index?.index;
  // Leave slide_index undefined when ProPresenter has no active slide so the
  // frontend keeps its current highlight instead of jumping to slide 0.
  return typeof idx === "number" ? { slide_index: idx } : {};
}

export async function getActivePresentation() {
  const res = await apiGet("/v1/presentation/active");
  return res.json();
}
