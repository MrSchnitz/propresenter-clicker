import WebSocket from "ws";

// ---------- Connection management ----------

let ws: WebSocket | null = null;
let connectPromise: Promise<void> | null = null;
let reconnectDelay = 500;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 10_000;

type Pending = {
  resolve: (msg: any) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};
const pending = new Map<string, Pending[]>();

function getConfig() {
  return {
    host: process.env.PROPRESENTER_HOST || "localhost",
    port: process.env.PROPRESENTER_PORT || "50001",
    password: process.env.PROPRESENTER_PASSWORD || "",
  };
}

function failAllPending(err: Error) {
  for (const queue of pending.values()) {
    for (const p of queue) {
      clearTimeout(p.timer);
      p.reject(err);
    }
  }
  pending.clear();
}

function connect(): Promise<void> {
  if (connectPromise) return connectPromise;

  const { host, port, password } = getConfig();
  const url = `ws://${host}:${port}/remote`;

  connectPromise = new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url);
    ws = socket;
    let authed = false;

    const settleReject = (err: Error) => {
      if (!authed) reject(err);
      failAllPending(err);
    };

    socket.on("open", () => {
      socket.send(
        JSON.stringify({ action: "authenticate", protocol: "701", password })
      );
    });

    socket.on("message", (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.action === "authenticate") {
        if (msg.authenticated === 1) {
          authed = true;
          reconnectDelay = 500;
          resolve();
        } else {
          settleReject(new Error(msg.error || "ProPresenter auth failed"));
          socket.close();
        }
        return;
      }

      // ProPresenter pushes these whenever the active slide changes — including
      // when the change is made in ProPresenter itself rather than via our app.
      // Without tracking them, getCurrentSlide() returns stale local state.
      if (
        msg.action === "presentationTriggerIndex" ||
        msg.action === "presentationSlideIndex"
      ) {
        const idx =
          typeof msg.slideIndex === "string"
            ? parseInt(msg.slideIndex, 10)
            : msg.slideIndex;
        if (Number.isFinite(idx)) currentSlideIndex = idx;
        if (msg.presentationPath) currentLocation = msg.presentationPath;
      }

      const queue = pending.get(msg.action);
      if (queue && queue.length > 0) {
        const p = queue.shift()!;
        clearTimeout(p.timer);
        p.resolve(msg);
      }
    });

    socket.on("close", () => {
      ws = null;
      connectPromise = null;
      settleReject(new Error("ProPresenter WebSocket closed"));
    });

    socket.on("error", (err) => {
      settleReject(err instanceof Error ? err : new Error(String(err)));
    });
  });

  // If the initial connect fails, back off before allowing a retry.
  connectPromise.catch(() => {
    const delay = reconnectDelay;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    setTimeout(() => {
      // nothing — next call to connect() creates a fresh attempt
    }, delay);
  });

  return connectPromise;
}

function request(
  action: string,
  replyAction: string,
  extra: Record<string, unknown> = {}
): Promise<any> {
  return connect().then(
    () =>
      new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          const q = pending.get(replyAction);
          if (q) {
            const idx = q.findIndex((p) => p.timer === timer);
            if (idx >= 0) q.splice(idx, 1);
          }
          reject(new Error(`ProPresenter request timed out: ${action}`));
        }, REQUEST_TIMEOUT_MS);

        let q = pending.get(replyAction);
        if (!q) {
          q = [];
          pending.set(replyAction, q);
        }
        q.push({ resolve, reject, timer });

        ws!.send(JSON.stringify({ action, ...extra }));
      })
  );
}

function sendFireAndForget(payload: Record<string, unknown>): Promise<void> {
  return connect().then(() => {
    ws!.send(JSON.stringify(payload));
  });
}

// ---------- Caches ----------

let playlistsRaw: any[] | null = null;
let libraryRaw: string[] | null = null;
const presentationCache = new Map<string, any>();
let currentLocation: string | null = null;
let currentSlideIndex = 0;

// ---------- Translation helpers ----------

function translatePlaylistItem(item: any, idx: number): any {
  const isPresentation =
    item.playlistItemType === "playlistItemTypePresentation";
  const isNested = Array.isArray(item.playlist);
  return {
    id: {
      uuid: item.playlistItemLocation ?? item.playlistLocation,
      name: item.playlistItemName ?? item.playlistName,
      index: idx,
    },
    type: isPresentation
      ? "presentation"
      : item.playlistType === "playlistTypePlaylist"
        ? "playlist"
        : item.playlistType === "playlistTypeGroup"
          ? "group"
          : "unknown",
    presentation_info: isPresentation
      ? { presentation_uuid: item.playlistItemLocation }
      : undefined,
    items: isNested
      ? item.playlist.map((c: any, i: number) => translatePlaylistItem(c, i))
      : undefined,
  };
}

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  const last = parts[parts.length - 1] || path;
  return last.replace(/\.pro$/i, "");
}

// ---------- Public API (matches REST surface) ----------

export async function getPlaylists() {
  if (!playlistsRaw) {
    const resp = await request("playlistRequestAll", "playlistRequestAll");
    playlistsRaw = resp.playlistAll || [];
  }
  return playlistsRaw!.map((p: any, idx: number) => ({
    id: {
      uuid: p.playlistLocation,
      name: p.playlistName,
      index: idx,
    },
    type: p.playlistType === "playlistTypePlaylist" ? "playlist" : "group",
    items: (p.playlist || []).map((item: any, i: number) =>
      translatePlaylistItem(item, i)
    ),
  }));
}

export async function getPlaylist(id: string) {
  if (!playlistsRaw) await getPlaylists();
  const p = playlistsRaw!.find((x: any) => x.playlistLocation === id);
  if (!p) return { items: [] };
  return {
    items: (p.playlist || []).map((item: any, i: number) =>
      translatePlaylistItem(item, i)
    ),
  };
}

export async function getLibraries() {
  return [
    {
      id: { uuid: "default", name: "Library", index: 0 },
      type: "library",
    },
  ];
}

export async function getLibrary(_id: string) {
  if (!libraryRaw) {
    const resp = await request("libraryRequest", "libraryRequest");
    libraryRaw = resp.library || [];
  }
  return {
    items: libraryRaw!.map((path, i) => ({
      id: { uuid: path, name: basename(path), index: i },
      type: "presentation",
      presentation_info: { presentation_uuid: path },
    })),
  };
}

export async function getPresentation(uuid: string) {
  let raw = presentationCache.get(uuid);
  if (!raw) {
    // Omitting presentationSlideQuality requests the highest available quality.
    // The official remote uses 100 as a fast first pass; this app prefers crisp
    // thumbnails up front since we only fetch once per presentation.
    const resp = await request("presentationRequest", "presentationCurrent", {
      presentationPath: uuid,
    });
    raw = resp.presentation;
    if (raw) {
      presentationCache.set(uuid, raw);
      const firstImg: string | undefined =
        raw.presentationSlideGroups?.[0]?.groupSlides?.[0]?.slideImage;
      if (firstImg) {
        const bytes = Buffer.from(firstImg, "base64").length;
        console.log(
          `[pp-ws] thumbnail bytes: ${bytes} (${(bytes / 1024).toFixed(1)} KB) — header: ${firstImg.slice(0, 16)}`
        );
      }
    }
  }
  const groups = ((raw && raw.presentationSlideGroups) || []).map((g: any) => ({
    name: g.groupName,
    slides: (g.groupSlides || []).map((s: any, i: number) => ({
      uuid: `${uuid}#${s.slideIndex ?? i}`,
      label: s.slideLabel,
      text: s.slideText,
    })),
  }));
  return {
    presentation: {
      name: raw?.presentationName,
      groups,
    },
  };
}

// Lookup the base64 slide image for a given flat slide index.
function findSlideImage(raw: any, slideIndex: number): string | undefined {
  let i = 0;
  for (const g of raw?.presentationSlideGroups || []) {
    for (const s of g.groupSlides || []) {
      if (i === slideIndex) return s.slideImage;
      i++;
    }
  }
  return undefined;
}

// Returns an object that quacks like a Fetch Response — only the methods used
// by routes.ts (`arrayBuffer()` and `headers.get("content-type")`) are needed.
export async function getSlideThumb(
  uuid: string,
  slideIndex: number,
  _quality = 400
): Promise<{
  arrayBuffer: () => Promise<ArrayBuffer>;
  headers: { get: (k: string) => string | null };
}> {
  let raw = presentationCache.get(uuid);
  if (!raw) {
    await getPresentation(uuid);
    raw = presentationCache.get(uuid);
  }
  const b64 = findSlideImage(raw, slideIndex);
  if (!b64) throw new Error(`slide image not available: ${slideIndex}`);
  const buf = Buffer.from(b64, "base64");
  return {
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "content-type" ? "image/jpeg" : null,
    },
  };
}

export async function triggerSlide(uuid: string, slideIndex: number) {
  await sendFireAndForget({
    action: "presentationTriggerIndex",
    slideIndex: String(slideIndex),
    presentationPath: uuid,
  });
  currentLocation = uuid;
  currentSlideIndex = slideIndex;
  return { ok: true };
}

export async function triggerNext() {
  await sendFireAndForget({ action: "presentationTriggerNext" });
  currentSlideIndex++;
  return { ok: true };
}

export async function triggerPrevious() {
  await sendFireAndForget({ action: "presentationTriggerPrevious" });
  if (currentSlideIndex > 0) currentSlideIndex--;
  return { ok: true };
}

export async function getCurrentSlide() {
  return { slide_index: currentSlideIndex };
}

export async function getActivePresentation() {
  if (!currentLocation) return {};
  const raw = presentationCache.get(currentLocation);
  return raw ? { presentation: { name: raw.presentationName } } : {};
}
