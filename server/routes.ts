import { Router, Request, Response, NextFunction } from "express";
import * as pp from "./proPresenterApi.js";
import {
  getLockedPresentation,
  setLockedPresentation,
  getSpeakerPin,
  setSpeakerPin,
} from "./state.js";

const router = Router();

// --- Admin auth middleware ---

function requirePin(req: Request, res: Response, next: NextFunction): void {
  const pin = req.headers.authorization;
  if (pin !== process.env.ADMIN_PIN) {
    res.status(401).json({ error: "Invalid PIN" });
    return;
  }
  next();
}

// Speaker auth is opt-in: when no PIN is set, anyone with the URL can use the
// speaker view (the original behavior). When the admin sets one, the same PIN
// is required on every speaker endpoint via the Authorization header.
function requireSpeakerPin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const speakerPin = getSpeakerPin();
  if (!speakerPin) {
    next();
    return;
  }
  // Thumbnails are loaded via <img src>, which can't carry Authorization
  // headers, so accept the PIN via query parameter as a fallback.
  const provided = req.headers.authorization ?? (req.query.pin as string | undefined);
  if (provided !== speakerPin) {
    res.status(401).json({ error: "Speaker PIN required" });
    return;
  }
  next();
}

// --- Admin routes ---

router.post("/api/admin/auth", (req, res) => {
  const { pin } = req.body;
  if (pin === process.env.ADMIN_PIN) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Invalid PIN" });
  }
});

router.get("/api/admin/playlists", requirePin, async (_req, res) => {
  try {
    const data = await pp.getPlaylists();
    res.json(data);
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.get("/api/admin/playlist/:id", requirePin, async (req, res) => {
  try {
    const data = await pp.getPlaylist(req.params.id);
    res.json(data);
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.get("/api/admin/libraries", requirePin, async (_req, res) => {
  try {
    const data = await pp.getLibraries();
    res.json(data);
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.get("/api/admin/library/:id", requirePin, async (req, res) => {
  try {
    const data = await pp.getLibrary(req.params.id);
    res.json(data);
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.get("/api/admin/presentation/:uuid", requirePin, async (req, res) => {
  try {
    const data = await pp.getPresentation(req.params.uuid);
    res.json(data);
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.post("/api/admin/lock", requirePin, (req, res) => {
  const { uuid, name, slideCount } = req.body;
  if (!uuid || !name) {
    res.status(400).json({ error: "uuid and name required" });
    return;
  }
  setLockedPresentation({ uuid, name, slideCount: slideCount || 0 });
  res.json({ ok: true, locked: getLockedPresentation() });
});

router.delete("/api/admin/lock", requirePin, (_req, res) => {
  setLockedPresentation(null);
  res.json({ ok: true });
});

router.get("/api/admin/lock", requirePin, (_req, res) => {
  res.json({ locked: getLockedPresentation() });
});

router.get("/api/admin/speaker-pin", requirePin, (_req, res) => {
  // Returning the PIN itself (not just whether one is set) so the admin UI can
  // pre-fill the input — same trust model as the locked presentation state.
  res.json({ pin: getSpeakerPin() });
});

router.put("/api/admin/speaker-pin", requirePin, (req, res) => {
  const { pin } = req.body ?? {};
  if (pin !== null && typeof pin !== "string") {
    res.status(400).json({ error: "pin must be a string or null" });
    return;
  }
  setSpeakerPin(pin);
  res.json({ ok: true, pin: getSpeakerPin() });
});

// --- Speaker routes (gated by speaker PIN when one is set) ---

// Public: the speaker UI uses this to decide whether to show a PIN screen, and
// to validate the entered PIN before storing it locally.
router.post("/api/speaker/auth", (req, res) => {
  const speakerPin = getSpeakerPin();
  if (!speakerPin) {
    res.json({ ok: true, required: false });
    return;
  }
  const { pin } = req.body ?? {};
  if (pin === speakerPin) {
    res.json({ ok: true, required: true });
  } else {
    res.status(401).json({ error: "Invalid PIN", required: true });
  }
});

router.get("/api/speaker/presentation", requireSpeakerPin, (_req, res) => {
  const locked = getLockedPresentation();
  if (!locked) {
    res.json({ locked: false });
    return;
  }
  res.json({ locked: true, ...locked });
});

router.get("/api/speaker/slide/:index/thumbnail", requireSpeakerPin, async (req, res) => {
  const locked = getLockedPresentation();
  if (!locked) {
    res.status(404).json({ error: "No presentation locked" });
    return;
  }
  try {
    const ppRes = await pp.getSlideThumb(
      locked.uuid,
      parseInt(req.params.index, 10),
      parseInt((req.query.quality as string) || "400", 10)
    );
    const buffer = await ppRes.arrayBuffer();
    res.set("Content-Type", ppRes.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=60");
    res.send(Buffer.from(buffer));
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.post("/api/speaker/slide/:index/trigger", requireSpeakerPin, async (req, res) => {
  const locked = getLockedPresentation();
  if (!locked) {
    res.status(404).json({ error: "No presentation locked" });
    return;
  }
  try {
    await pp.triggerSlide(locked.uuid, parseInt(req.params.index, 10));
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.post("/api/speaker/next", requireSpeakerPin, async (_req, res) => {
  try {
    await pp.triggerNext();
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.post("/api/speaker/previous", requireSpeakerPin, async (_req, res) => {
  try {
    await pp.triggerPrevious();
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.get("/api/speaker/status", requireSpeakerPin, async (_req, res) => {
  try {
    const data = await pp.getCurrentSlide();
    res.json(data);
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.get("/api/health", async (_req, res) => {
  try {
    await pp.getPlaylists();
    res.json({ pp: true });
  } catch {
    res.json({ pp: false });
  }
});

export default router;
