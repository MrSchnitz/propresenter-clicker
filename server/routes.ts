import { Router, Request, Response, NextFunction } from "express";
import * as pp from "./proPresenterApi.js";
import { getLockedPresentation, setLockedPresentation } from "./state.js";

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

// --- Speaker routes (no auth) ---

router.get("/api/speaker/presentation", (_req, res) => {
  const locked = getLockedPresentation();
  if (!locked) {
    res.json({ locked: false });
    return;
  }
  res.json({ locked: true, ...locked });
});

router.get("/api/speaker/slide/:index/thumbnail", async (req, res) => {
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

router.post("/api/speaker/slide/:index/trigger", async (req, res) => {
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

router.post("/api/speaker/next", async (_req, res) => {
  try {
    await pp.triggerNext();
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.post("/api/speaker/previous", async (_req, res) => {
  try {
    await pp.triggerPrevious();
    res.json({ ok: true });
  } catch {
    res.status(502).json({ error: "Cannot reach ProPresenter" });
  }
});

router.get("/api/speaker/status", async (_req, res) => {
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
