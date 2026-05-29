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

export async function adminGetSpeakerPin(pin: string) {
  return asJson(
    await fetch(`${BASE}/api/admin/speaker-pin`, { headers: authHeaders(pin) })
  );
}

export async function adminSetSpeakerPin(pin: string, speakerPin: string | null) {
  return asJson(
    await fetch(`${BASE}/api/admin/speaker-pin`, {
      method: "PUT",
      headers: authHeaders(pin),
      body: JSON.stringify({ pin: speakerPin }),
    })
  );
}

// --- Speaker ---

function speakerHeaders(pin?: string | null): HeadersInit {
  return pin ? { Authorization: pin } : {};
}

// Returns { ok: true, required: boolean } when the PIN is valid (or none is
// required); throws on 401 so callers can prompt for a new PIN.
export async function speakerAuth(pin: string | null) {
  const res = await fetch(`${BASE}/api/speaker/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  return asJson(res);
}

export async function speakerGetPresentation(pin?: string | null) {
  return asJson(
    await fetch(`${BASE}/api/speaker/presentation`, {
      headers: speakerHeaders(pin),
    })
  );
}

export function speakerSlideThumbUrl(
  index: number,
  quality = 400,
  pin?: string | null
) {
  const base = `${BASE}/api/speaker/slide/${index}/thumbnail?quality=${quality}`;
  return pin ? `${base}&pin=${encodeURIComponent(pin)}` : base;
}

export async function speakerTriggerSlide(index: number, pin?: string | null) {
  return asJson(
    await fetch(`${BASE}/api/speaker/slide/${index}/trigger`, {
      method: "POST",
      headers: speakerHeaders(pin),
    })
  );
}

export async function speakerNext(pin?: string | null) {
  return asJson(
    await fetch(`${BASE}/api/speaker/next`, {
      method: "POST",
      headers: speakerHeaders(pin),
    })
  );
}

export async function speakerPrevious(pin?: string | null) {
  return asJson(
    await fetch(`${BASE}/api/speaker/previous`, {
      method: "POST",
      headers: speakerHeaders(pin),
    })
  );
}

export async function speakerGetStatus(pin?: string | null) {
  return asJson(
    await fetch(`${BASE}/api/speaker/status`, {
      headers: speakerHeaders(pin),
    })
  );
}
