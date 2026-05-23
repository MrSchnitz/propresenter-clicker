const BASE = "";

function authHeaders(pin: string): HeadersInit {
  return { Authorization: pin, "Content-Type": "application/json" };
}

// --- Admin ---

export async function adminAuth(pin: string) {
  const res = await fetch(`${BASE}/api/admin/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new Error("Invalid PIN");
  return res.json();
}

export async function adminGetPlaylists(pin: string) {
  const res = await fetch(`${BASE}/api/admin/playlists`, {
    headers: authHeaders(pin),
  });
  return res.json();
}

export async function adminGetPlaylist(pin: string, id: string) {
  const res = await fetch(
    `${BASE}/api/admin/playlist/${encodeURIComponent(id)}`,
    { headers: authHeaders(pin) }
  );
  return res.json();
}

export async function adminGetLibraries(pin: string) {
  const res = await fetch(`${BASE}/api/admin/libraries`, {
    headers: authHeaders(pin),
  });
  return res.json();
}

export async function adminGetLibrary(pin: string, id: string) {
  const res = await fetch(
    `${BASE}/api/admin/library/${encodeURIComponent(id)}`,
    { headers: authHeaders(pin) }
  );
  return res.json();
}

export async function adminGetPresentation(pin: string, uuid: string) {
  const res = await fetch(
    `${BASE}/api/admin/presentation/${encodeURIComponent(uuid)}`,
    { headers: authHeaders(pin) }
  );
  return res.json();
}

export async function adminLock(
  pin: string,
  uuid: string,
  name: string,
  slideCount: number
) {
  const res = await fetch(`${BASE}/api/admin/lock`, {
    method: "POST",
    headers: authHeaders(pin),
    body: JSON.stringify({ uuid, name, slideCount }),
  });
  return res.json();
}

export async function adminUnlock(pin: string) {
  const res = await fetch(`${BASE}/api/admin/lock`, {
    method: "DELETE",
    headers: authHeaders(pin),
  });
  return res.json();
}

export async function adminGetLock(pin: string) {
  const res = await fetch(`${BASE}/api/admin/lock`, {
    headers: authHeaders(pin),
  });
  return res.json();
}

// --- Speaker ---

export async function speakerGetPresentation() {
  const res = await fetch(`${BASE}/api/speaker/presentation`);
  return res.json();
}

export function speakerSlideThumbUrl(index: number, quality = 400) {
  return `${BASE}/api/speaker/slide/${index}/thumbnail?quality=${quality}`;
}

export async function speakerTriggerSlide(index: number) {
  const res = await fetch(`${BASE}/api/speaker/slide/${index}/trigger`, {
    method: "POST",
  });
  return res.json();
}

export async function speakerNext() {
  const res = await fetch(`${BASE}/api/speaker/next`, { method: "POST" });
  return res.json();
}

export async function speakerPrevious() {
  const res = await fetch(`${BASE}/api/speaker/previous`, { method: "POST" });
  return res.json();
}

export async function speakerGetStatus() {
  const res = await fetch(`${BASE}/api/speaker/status`);
  return res.json();
}
