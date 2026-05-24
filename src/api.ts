const BASE = "";

function authHeaders(pin: string): HeadersInit {
  return { Authorization: pin, "Content-Type": "application/json" };
}

// Throws on non-2xx so callers' try/catch fires instead of getting back
// `{ error: "..." }` and crashing later when they try to .map over it.
async function asJson(res: Response): Promise<any> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* response body wasn't JSON — keep the status message */
    }
    throw new Error(msg);
  }
  return res.json();
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
  return asJson(
    await fetch(`${BASE}/api/admin/playlists`, { headers: authHeaders(pin) })
  );
}

export async function adminGetPlaylist(pin: string, id: string) {
  return asJson(
    await fetch(`${BASE}/api/admin/playlist/${encodeURIComponent(id)}`, {
      headers: authHeaders(pin),
    })
  );
}

export async function adminGetLibraries(pin: string) {
  return asJson(
    await fetch(`${BASE}/api/admin/libraries`, { headers: authHeaders(pin) })
  );
}

export async function adminGetLibrary(pin: string, id: string) {
  return asJson(
    await fetch(`${BASE}/api/admin/library/${encodeURIComponent(id)}`, {
      headers: authHeaders(pin),
    })
  );
}

export async function adminGetPresentation(pin: string, uuid: string) {
  return asJson(
    await fetch(`${BASE}/api/admin/presentation/${encodeURIComponent(uuid)}`, {
      headers: authHeaders(pin),
    })
  );
}

export async function adminLock(
  pin: string,
  uuid: string,
  name: string,
  slideCount: number
) {
  return asJson(
    await fetch(`${BASE}/api/admin/lock`, {
      method: "POST",
      headers: authHeaders(pin),
      body: JSON.stringify({ uuid, name, slideCount }),
    })
  );
}

export async function adminUnlock(pin: string) {
  return asJson(
    await fetch(`${BASE}/api/admin/lock`, {
      method: "DELETE",
      headers: authHeaders(pin),
    })
  );
}

export async function adminGetLock(pin: string) {
  return asJson(
    await fetch(`${BASE}/api/admin/lock`, { headers: authHeaders(pin) })
  );
}

// --- Speaker ---

export async function speakerGetPresentation() {
  return asJson(await fetch(`${BASE}/api/speaker/presentation`));
}

export function speakerSlideThumbUrl(index: number, quality = 400) {
  return `${BASE}/api/speaker/slide/${index}/thumbnail?quality=${quality}`;
}

export async function speakerTriggerSlide(index: number) {
  return asJson(
    await fetch(`${BASE}/api/speaker/slide/${index}/trigger`, {
      method: "POST",
    })
  );
}

export async function speakerNext() {
  return asJson(
    await fetch(`${BASE}/api/speaker/next`, { method: "POST" })
  );
}

export async function speakerPrevious() {
  return asJson(
    await fetch(`${BASE}/api/speaker/previous`, { method: "POST" })
  );
}

export async function speakerGetStatus() {
  return asJson(await fetch(`${BASE}/api/speaker/status`));
}
