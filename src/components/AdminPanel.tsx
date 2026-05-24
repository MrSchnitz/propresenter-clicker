import { useState, useEffect, useCallback, useRef } from "react";
import {
  adminGetPlaylists,
  adminGetPlaylist,
  adminGetPresentation,
  adminLock,
  adminUnlock,
  adminGetLock,
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
  "whitespace-nowrap rounded-app border border-success bg-transparent px-3 py-1 text-xs text-success disabled:bg-success disabled:text-black disabled:opacity-70";

export default function AdminPanel({ pin, onLogout }: Props) {
  const { t, plural } = useI18n();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [locked, setLocked] = useState<LockedInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // null = unknown (haven't checked yet), avoids banner flash on mount
  const [ppConnected, setPpConnected] = useState<boolean | null>(null);

  const loadLock = useCallback(async () => {
    try {
      const data = await adminGetLock(pin);
      setLocked(data.locked || null);
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
  }, [loadLock, loadPlaylists]);

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
      setPlaylistItems(data?.items || []);
    } catch {
      setPlaylistItems([]);
    }
  }

  async function handleLock(uuid: string, name: string) {
    setLoading(true);
    try {
      const data = await adminGetPresentation(pin, uuid);
      const pres = data?.presentation;
      const slideCount = pres?.groups
        ? pres.groups.reduce(
            (sum: number, g: { slides?: unknown[] }) =>
              sum + (g.slides?.length || 0),
            0
          )
        : 0;
      await adminLock(pin, uuid, name, slideCount);
      setLocked({ uuid, name, slideCount });
    } catch {
      setError(t("failedToLock"));
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    try {
      await adminUnlock(pin);
      setLocked(null);
    } catch {
      setError(t("failedToUnlock"));
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
        {locked ? (
          <div className="flex items-center justify-between gap-3">
            <span>
              {t("lockedLabel")}: <strong>{locked.name}</strong> ({locked.slideCount}{" "}
              {plural("slides", locked.slideCount)})
            </span>
            <button className={btnDanger} onClick={handleUnlock}>
              {t("unlock")}
            </button>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">{t("noPresentationLocked")}</p>
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
        {playlists.map((pl) => (
          <li key={pl.id.uuid}>
            <button
              onClick={() => togglePlaylist(pl.id.uuid)}
              className="block w-full border-0 border-b border-white/5 bg-transparent p-3 text-left text-[15px] text-fg"
            >
              {expandedPlaylist === pl.id.uuid ? "v" : ">"} {pl.id.name}
            </button>

            {expandedPlaylist === pl.id.uuid && (
              <ul className="list-none pl-4">
                {playlistItems.length === 0 && (
                  <li className="text-sm text-fg-muted">{t("noItems")}</li>
                )}
                {playlistItems
                  .filter((item) => item.type === "presentation")
                  .map((item, i) => {
                    const presUuid =
                      item.presentation_info?.presentation_uuid ||
                      item.id.uuid;
                    return (
                      <li
                        key={presUuid || i}
                        className="flex items-center justify-between border-b border-white/[0.04] px-3 py-2.5 text-sm"
                      >
                        <span>{item.id?.name || t("untitled")}</span>
                        <button
                          className={btnLock}
                          onClick={() => handleLock(presUuid, item.id.name)}
                          disabled={locked?.uuid === presUuid}
                        >
                          {locked?.uuid === presUuid ? t("lockedLabel") : t("lock")}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
