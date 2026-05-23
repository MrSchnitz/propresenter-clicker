const host = process.env.PROPRESENTER_HOST || "localhost";
const port = process.env.PROPRESENTER_PORT || "50001";
const baseUrl = `http://${host}:${port}`;

async function apiGet(path: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`);
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
  return apiGet(
    `/v1/presentation/${encodeURIComponent(uuid)}/trigger/${slideIndex}`
  );
}

export async function triggerNext() {
  return apiGet("/v1/trigger/next");
}

export async function triggerPrevious() {
  return apiGet("/v1/trigger/previous");
}

// Status

export async function getCurrentSlide() {
  const res = await apiGet("/v1/slide/current");
  return res.json();
}

export async function getActivePresentation() {
  const res = await apiGet("/v1/presentation/current");
  return res.json();
}
