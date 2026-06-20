import { useState, useEffect, useCallback, useRef } from "react";
import {
  adminGetPlaylists,
  adminGetPlaylist,
  adminSetLock,
  adminUnlock,
  adminGetLock,
  adminGetSpeakerPin,
  adminSetSpeakerPin,
} from "../api";
import { useI18n } from "../i18n";
import LanguageToggle from "./LanguageToggle";

interface Props {
  pin: string;
  onLogout: () => void;
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

export default function AdminPanel({ pin, onLogout }: Props) {
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

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetPlaylists(pin);
      setPlaylists(data || []);
    } catch {
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
  }, [loadLock, loadPlaylists, loadSpeakerPin]);

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
    </div>
  );
}
