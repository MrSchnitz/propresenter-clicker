import { useState, useEffect, useCallback, useRef } from "react";
import {
  adminGetPlaylists,
  adminGetPlaylist,
  adminSetLock,
  adminUnlock,
  adminGetLock,
  adminGetSpeakerPin,
  adminSetSpeakerPin,
  adminGetSettings,
  adminUpdateSettings,
  ConnectionSettings,
} from "../api";
import { useI18n } from "../i18n";
import LanguageToggle from "./LanguageToggle";

interface Props {
  pin: string;
  onLogout: () => void;
  // Called when the admin PIN is changed from the settings section, so the
  // parent can adopt the new PIN (subsequent requests must use it).
  onPinChange: (pin: string) => void;
}

interface PlaylistItem {
  id: { uuid: string; name: string; index: number };
  type: string;
  items?: PlaylistItem[];
  presentation_info?: { presentation_uuid: string };
}

interface LockedInfo {
  uuid: string;
  name: string;
  slideCount: number;
}

const inputCls =
  "mt-1 w-full rounded-app border border-white/10 bg-card p-2.5 text-sm text-fg outline-none focus:border-accent";
const btnSmall =
  "rounded-app border border-fg-muted bg-transparent px-3.5 py-1.5 text-[13px] text-fg-muted";
const btnDanger =
  "whitespace-nowrap rounded-app bg-accent px-3.5 py-1.5 text-[13px] text-white";
const btnLock =
  "whitespace-nowrap rounded-app border border-success bg-transparent px-3 py-1 text-xs text-success disabled:opacity-50";
// Selected state doubles as the "unselect" action — styled with the app's
// accent (red/pink), matching the other destructive buttons (e.g. Clear all).
const btnUnselect =
  "whitespace-nowrap rounded-app border border-accent bg-accent px-3 py-1 text-xs text-white disabled:opacity-50";

// The uuid used to trigger/fetch a presentation comes from presentation_info
// when present (REST), falling back to the item's own uuid (WS library items).
function presUuidOf(item: PlaylistItem): string {
  return item.presentation_info?.presentation_uuid || item.id.uuid;
}

// Flatten a playlist (including nested groups) to its presentation items.
function collectPresentations(
  items: PlaylistItem[]
): { uuid: string; name: string }[] {
  const out: { uuid: string; name: string }[] = [];
  for (const item of items) {
    if (item.type === "presentation") {
      out.push({ uuid: presUuidOf(item), name: item.id?.name || "" });
    } else if (item.items) {
      out.push(...collectPresentations(item.items));
    }
  }
  return out;
}

export default function AdminPanel({ pin, onLogout, onPinChange }: Props) {
  const { t, plural } = useI18n();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  // Cache of each playlist's flattened presentations, so we can show whether a
  // whole playlist is selected (and toggle it) without re-fetching every render.
  const [playlistPresentations, setPlaylistPresentations] = useState<
    Record<string, { uuid: string; name: string }[]>
  >({});
  const [locked, setLocked] = useState<LockedInfo[]>([]);
  const [speakerPin, setSpeakerPinState] = useState<string | null>(null);
  const [speakerPinDraft, setSpeakerPinDraft] = useState("");
  const [speakerPinSaving, setSpeakerPinSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // null = unknown (haven't checked yet), avoids banner flash on mount
  const [ppConnected, setPpConnected] = useState<boolean | null>(null);
  // Connection settings: `settings` mirrors the server, `settingsDraft` is the
  // form state; Save is enabled only when they differ.
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<ConnectionSettings | null>(
    null
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<{
    kind: "ok" | "warn" | "error";
    text: string;
  } | null>(null);
  const [adminPinOpen, setAdminPinOpen] = useState(false);
  const [adminPinSaving, setAdminPinSaving] = useState(false);
  const [adminPinNotice, setAdminPinNotice] = useState<{
    kind: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const isAdded = useCallback(
    (uuid: string) => locked.some((l) => l.uuid === uuid),
    [locked]
  );
  // Current locked set expressed as the {uuid,name} items the API expects.
  const currentItems = useCallback(
    () => locked.map((l) => ({ uuid: l.uuid, name: l.name })),
    [locked]
  );

  // A playlist is "fully selected" when we know its presentations and every one
  // of them is in the locked set. Unknown (not yet fetched) → not selected.
  function playlistFullySelected(playlistId: string): boolean {
    const found = playlistPresentations[playlistId];
    return !!found && found.length > 0 && found.every((p) => isAdded(p.uuid));
  }

  const loadLock = useCallback(async () => {
    try {
      const data = await adminGetLock(pin);
      setLocked(data.presentations || []);
    } catch {
      /* ignore */
    }
  }, [pin]);

  const loadSpeakerPin = useCallback(async () => {
    try {
      const data = await adminGetSpeakerPin(pin);
      setSpeakerPinState(data?.pin ?? null);
      setSpeakerPinDraft(data?.pin ?? "");
    } catch {
      /* ignore */
    }
  }, [pin]);

  const loadSettings = useCallback(async () => {
    try {
      const data = await adminGetSettings(pin);
      setSettings(data.settings);
      setSettingsDraft(data.settings);
    } catch {
      /* ignore */
    }
  }, [pin]);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetPlaylists(pin);
      setPlaylists(data || []);
    } catch {
      // Drop the previous list — leaving it up would suggest these playlists
      // are still reachable on the (new/offline) connection.
      setPlaylists([]);
      setError(t("cannotConnect"));
    } finally {
      setLoading(false);
    }
    // t is read inside but only used for the error string; intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  useEffect(() => {
    loadPlaylists();
    loadLock();
    loadSpeakerPin();
    loadSettings();
  }, [loadLock, loadPlaylists, loadSpeakerPin, loadSettings]);

  // Prefetch each playlist's presentations in the background so the "whole
  // playlist" buttons can show their selected state without the user expanding
  // them first (e.g. after a reload). Best-effort and sequential to stay gentle.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const pl of playlists) {
        const id = pl.id.uuid;
        if (playlistPresentations[id]) continue;
        try {
          const data = await adminGetPlaylist(pin, id);
          if (cancelled) return;
          setPlaylistPresentations((m) =>
            m[id] ? m : { ...m, [id]: collectPresentations(data?.items || []) }
          );
        } catch {
          /* ignore — button just falls back to the default state */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // playlistPresentations intentionally omitted: the in-loop guard avoids
    // refetching, and including it would restart the loop on every populate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlists, pin]);

  // Poll /api/health so we can show a "PP not running" banner and auto-recover
  // when the user starts ProPresenter without needing a manual refresh.
  const reloadRef = useRef(() => {
    loadPlaylists();
    loadLock();
  });
  reloadRef.current = () => {
    loadPlaylists();
    loadLock();
  };

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      let next: boolean;
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        next = data.pp === true;
      } catch {
        next = false;
      }
      if (cancelled) return;
      setPpConnected((prev) => {
        if (prev === false && next === true) {
          // Transition offline → online: re-fetch lists
          reloadRef.current();
        }
        return next;
      });
    };
    check();
    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function togglePlaylist(id: string) {
    if (expandedPlaylist === id) {
      setExpandedPlaylist(null);
      setPlaylistItems([]);
      return;
    }
    setExpandedPlaylist(id);
    try {
      const data = await adminGetPlaylist(pin, id);
      const items = data?.items || [];
      setPlaylistItems(items);
      setPlaylistPresentations((m) => ({ ...m, [id]: collectPresentations(items) }));
    } catch {
      setPlaylistItems([]);
    }
  }

  // Persist a new locked set and adopt the server's response (which fills in
  // slide counts). The server de-dupes by uuid and resolves counts in parallel.
  const persistLock = useCallback(
    async (items: { uuid: string; name: string }[]) => {
      setSaving(true);
      setError("");
      try {
        const data = await adminSetLock(pin, items);
        setLocked(data.presentations || []);
      } catch {
        setError(t("failedToLock"));
      } finally {
        setSaving(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [pin]
  );

  function handleToggle(uuid: string, name: string) {
    if (isAdded(uuid)) {
      persistLock(currentItems().filter((it) => it.uuid !== uuid));
    } else {
      persistLock([...currentItems(), { uuid, name }]);
    }
  }

  // Toggle an entire playlist: if all its presentations are already selected,
  // remove them; otherwise add (merge) them. The server de-dupes by uuid.
  async function handleToggleWholePlaylist(playlistId: string) {
    setSaving(true);
    setError("");
    try {
      let found = playlistPresentations[playlistId];
      if (!found) {
        const data = await adminGetPlaylist(pin, playlistId);
        found = collectPresentations(data?.items || []);
        setPlaylistPresentations((m) => ({ ...m, [playlistId]: found! }));
      }
      const allSelected =
        found.length > 0 && found.every((p) => isAdded(p.uuid));
      let items: { uuid: string; name: string }[];
      if (allSelected) {
        const ids = new Set(found.map((p) => p.uuid));
        items = currentItems().filter((it) => !ids.has(it.uuid));
      } else {
        items = [...currentItems(), ...found];
      }
      const res = await adminSetLock(pin, items);
      setLocked(res.presentations || []);
    } catch {
      setError(t("failedToLock"));
    } finally {
      setSaving(false);
    }
  }

  async function handleClearAll() {
    setSaving(true);
    try {
      await adminUnlock(pin);
      setLocked([]);
    } catch {
      setError(t("failedToUnlock"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSpeakerPin() {
    const next = speakerPinDraft.trim();
    setSpeakerPinSaving(true);
    try {
      await adminSetSpeakerPin(pin, next.length ? next : null);
      setSpeakerPinState(next.length ? next : null);
    } finally {
      setSpeakerPinSaving(false);
    }
  }

  function updateSettingsDraft<K extends keyof ConnectionSettings>(
    key: K,
    value: ConnectionSettings[K]
  ) {
    setSettingsDraft((d) => (d ? { ...d, [key]: value } : d));
    setSettingsNotice(null);
    setAdminPinNotice(null);
  }

  // The admin PIN shares the settings endpoint but is edited in its own
  // section, so connection dirtiness/saving deliberately excludes it.
  const CONNECTION_KEYS = ["ppHost", "ppPort", "ppProtocol", "ppPassword"] as const;

  const settingsDirty =
    !!settingsDraft &&
    !!settings &&
    CONNECTION_KEYS.some((k) => settingsDraft[k] !== settings[k]);

  const adminPinDirty =
    !!settingsDraft &&
    !!settings &&
    settingsDraft.adminPin.trim() !== "" &&
    settingsDraft.adminPin.trim() !== settings.adminPin;

  async function handleSaveSettings() {
    if (!settingsDraft) return;
    setSettingsSaving(true);
    setSettingsNotice(null);
    try {
      const res = await adminUpdateSettings(pin, {
        ppHost: settingsDraft.ppHost,
        ppPort: settingsDraft.ppPort,
        ppProtocol: settingsDraft.ppProtocol,
        ppPassword: settingsDraft.ppPassword,
      });
      const next: ConnectionSettings = res.settings;
      setSettings(next);
      // Keep an in-progress admin PIN edit; adopt the saved connection values.
      setSettingsDraft((d) => (d ? { ...next, adminPin: d.adminPin } : next));
      setSettingsNotice(
        res.persisted
          ? { kind: "ok", text: t("settingsSaved") }
          : { kind: "warn", text: t("settingsNotPersisted") }
      );
      // The app may now be talking to a different ProPresenter — drop
      // everything derived from the old connection and refetch.
      setPlaylistPresentations({});
      setExpandedPlaylist(null);
      setPlaylistItems([]);
      setPpConnected(null); // re-evaluated by the next health poll
      loadPlaylists();
      loadLock();
    } catch (e) {
      setSettingsNotice({
        kind: "error",
        text:
          e instanceof Error && e.message ? e.message : t("settingsSaveFailed"),
      });
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleSaveAdminPin() {
    if (!settingsDraft) return;
    setAdminPinSaving(true);
    setAdminPinNotice(null);
    try {
      const res = await adminUpdateSettings(pin, {
        adminPin: settingsDraft.adminPin.trim(),
      });
      const next: ConnectionSettings = res.settings;
      setSettings(next);
      setSettingsDraft((d) => (d ? { ...d, adminPin: next.adminPin } : next));
      setAdminPinNotice(
        res.persisted
          ? { kind: "ok", text: t("settingsSaved") }
          : { kind: "warn", text: t("settingsNotPersisted") }
      );
      // Adopt the new PIN so subsequent requests stay authorized.
      if (next.adminPin !== pin) onPinChange(next.adminPin);
    } catch (e) {
      setAdminPinNotice({
        kind: "error",
        text:
          e instanceof Error && e.message ? e.message : t("settingsSaveFailed"),
      });
    } finally {
      setAdminPinSaving(false);
    }
  }

  async function handleClearSpeakerPin() {
    setSpeakerPinSaving(true);
    try {
      await adminSetSpeakerPin(pin, null);
      setSpeakerPinState(null);
      setSpeakerPinDraft("");
    } finally {
      setSpeakerPinSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[600px] p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px]">{t("admin")}</h1>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button className={btnSmall} onClick={onLogout}>
            {t("logout")}
          </button>
        </div>
      </header>

      {ppConnected === false && (
        <div
          className="mb-4 flex items-start gap-3 rounded-app border border-accent/40 bg-accent/10 p-4"
          role="alert"
        >
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2 L1 21 H23 Z M12 9 V14 M12 17 V18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="min-w-0">
            <p className="font-semibold text-accent">{t("ppNotConnected")}</p>
            <p className="mt-1 text-sm text-fg-muted">{t("ppNotConnectedHelp")}</p>
          </div>
        </div>
      )}

      <div className="mb-5 rounded-app bg-surface p-3.5">
        <button
          className="flex w-full items-center justify-between border-0 bg-transparent p-0 text-left"
          onClick={() => setSettingsOpen((o) => !o)}
        >
          <h2 className="text-base font-semibold">{t("connectionSection")}</h2>
          <span className="text-fg-muted">{settingsOpen ? "v" : ">"}</span>
        </button>
        {settingsOpen && settingsDraft && (
          <div className="mt-3">
            <p className="mb-3 text-xs text-fg-muted">{t("connectionHelp")}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs text-fg-muted">
                {t("ppHostLabel")}
                <input
                  type="text"
                  className={inputCls}
                  value={settingsDraft.ppHost}
                  onChange={(e) => updateSettingsDraft("ppHost", e.target.value)}
                />
              </label>
              <label className="text-xs text-fg-muted">
                {t("ppPortLabel")}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={inputCls}
                  value={settingsDraft.ppPort}
                  onChange={(e) => updateSettingsDraft("ppPort", e.target.value)}
                />
              </label>
              <label className="text-xs text-fg-muted">
                {t("ppProtocolLabel")}
                <select
                  className={inputCls}
                  value={settingsDraft.ppProtocol}
                  onChange={(e) =>
                    updateSettingsDraft(
                      "ppProtocol",
                      e.target.value as ConnectionSettings["ppProtocol"]
                    )
                  }
                >
                  <option value="ws">WebSocket (PP &lt; 7.9)</option>
                  <option value="rest">REST (PP 7.9+)</option>
                </select>
              </label>
              {/* The password only exists in the WS remote protocol — PP's
                  REST API has no authentication, so hide the field there. */}
              {settingsDraft.ppProtocol === "ws" && (
                <label className="text-xs text-fg-muted">
                  {t("ppPasswordLabel")}
                  <input
                    type="text"
                    className={inputCls}
                    value={settingsDraft.ppPassword}
                    onChange={(e) =>
                      updateSettingsDraft("ppPassword", e.target.value)
                    }
                  />
                </label>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving || !settingsDirty}
                className="rounded-app bg-accent px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("save")}
              </button>
              {settingsNotice && (
                <p
                  className={
                    settingsNotice.kind === "ok"
                      ? "text-sm text-success"
                      : settingsNotice.kind === "warn"
                        ? "text-sm text-fg-muted"
                        : "text-sm text-accent"
                  }
                >
                  {settingsNotice.text}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mb-5 rounded-app bg-surface p-3.5">
        <button
          className="flex w-full items-center justify-between border-0 bg-transparent p-0 text-left"
          onClick={() => setAdminPinOpen((o) => !o)}
        >
          <h2 className="text-base font-semibold">{t("adminPinSection")}</h2>
          <span className="text-fg-muted">{adminPinOpen ? "v" : ">"}</span>
        </button>
        {adminPinOpen && (
        <div className="mt-3">
        <p className="mb-3 text-xs text-fg-muted">{t("adminPinHelp")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={settingsDraft?.adminPin ?? ""}
            onChange={(e) => updateSettingsDraft("adminPin", e.target.value)}
            className="flex-1 rounded-app border border-white/10 bg-card p-2.5 text-sm text-fg outline-none focus:border-accent"
          />
          <button
            onClick={handleSaveAdminPin}
            disabled={adminPinSaving || !adminPinDirty}
            className="rounded-app bg-accent px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("save")}
          </button>
        </div>
        {adminPinNotice && (
          <p
            className={
              adminPinNotice.kind === "ok"
                ? "mt-2 text-sm text-success"
                : adminPinNotice.kind === "warn"
                  ? "mt-2 text-sm text-fg-muted"
                  : "mt-2 text-sm text-accent"
            }
          >
            {adminPinNotice.text}
          </p>
        )}
        </div>
        )}
      </div>

      <div className="mb-5 rounded-app bg-surface p-3.5">
        <h2 className="mb-1 text-base font-semibold">{t("speakerPinSection")}</h2>
        <p className="mb-3 text-xs text-fg-muted">{t("speakerPinHelp")}</p>
        <p className="mb-3 text-sm">
          {speakerPin ? t("speakerPinIsSet") : t("speakerPinNotSet")}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={t("speakerPinPlaceholder")}
            value={speakerPinDraft}
            onChange={(e) => setSpeakerPinDraft(e.target.value)}
            className="flex-1 rounded-app border border-white/10 bg-card p-2.5 text-sm text-fg outline-none focus:border-accent"
          />
          <button
            onClick={handleSaveSpeakerPin}
            disabled={speakerPinSaving || speakerPinDraft.trim() === (speakerPin ?? "")}
            className="rounded-app bg-accent px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("save")}
          </button>
          <button
            onClick={handleClearSpeakerPin}
            disabled={speakerPinSaving || !speakerPin}
            className={btnSmall}
          >
            {t("clear")}
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-app bg-surface p-3.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {t("chosenPresentations")}
            {locked.length > 0 && (
              <span className="ml-2 text-sm font-normal text-fg-muted">
                ({locked.length})
              </span>
            )}
          </h2>
          {locked.length > 0 && (
            <button
              className={btnDanger}
              onClick={handleClearAll}
              disabled={saving}
            >
              {t("clearAll")}
            </button>
          )}
        </div>
        {locked.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("noPresentationLocked")}</p>
        ) : (
          <ul className="list-none">
            {locked.map((p, i) => (
              <li
                key={p.uuid}
                className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-2 last:border-b-0 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="mr-1.5 text-fg-muted tabular-nums">
                    {i + 1}.
                  </span>
                  {p.name}{" "}
                  <span className="text-fg-muted">
                    ({p.slideCount} {plural("slides", p.slideCount)})
                  </span>
                </span>
                <button
                  className={btnSmall}
                  onClick={() =>
                    persistLock(
                      currentItems().filter((it) => it.uuid !== p.uuid)
                    )
                  }
                  disabled={saving}
                >
                  {t("remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-accent">{error}</p>}

      {/* While PP is known to be offline the playlist list is hidden — the
          banner above already explains the state, and a stale list would look
          selectable. */}
      {ppConnected !== false && (
      <>
      <h2 className="mb-3 text-base uppercase tracking-wider text-fg-muted">
        {t("playlists")}
      </h2>
      {loading && !playlists.length && (
        <p className="text-sm text-fg-muted">{t("loading")}</p>
      )}

      <ul className="list-none">
        {playlists.map((pl) => {
          const plSelected = playlistFullySelected(pl.id.uuid);
          return (
          <li key={pl.id.uuid}>
            <div className="flex items-center gap-2 border-b border-white/5">
              <button
                onClick={() => togglePlaylist(pl.id.uuid)}
                className="flex-1 border-0 bg-transparent p-3 text-left text-[15px] text-fg"
              >
                {expandedPlaylist === pl.id.uuid ? "v" : ">"} {pl.id.name}
              </button>
              <button
                className={plSelected ? btnUnselect : btnLock}
                onClick={() => handleToggleWholePlaylist(pl.id.uuid)}
                disabled={saving}
              >
                {plSelected ? t("unselect") : t("lockPlaylist")}
              </button>
            </div>

            {expandedPlaylist === pl.id.uuid && (
              <ul className="list-none pl-4">
                {playlistItems.length === 0 && (
                  <li className="text-sm text-fg-muted">{t("noItems")}</li>
                )}
                {playlistItems
                  .filter((item) => item.type === "presentation")
                  .map((item, i) => {
                    const presUuid = presUuidOf(item);
                    const added = isAdded(presUuid);
                    return (
                      <li
                        key={presUuid || i}
                        className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {item.id?.name || t("untitled")}
                        </span>
                        <button
                          className={added ? btnUnselect : btnLock}
                          onClick={() =>
                            handleToggle(presUuid, item.id.name)
                          }
                          disabled={saving}
                        >
                          {added ? t("unselect") : t("add")}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </li>
          );
        })}
      </ul>
      </>
      )}
    </div>
  );
}
