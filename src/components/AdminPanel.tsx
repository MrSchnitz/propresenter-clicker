import { useState, useEffect, useCallback } from "react";
import {
  adminGetPlaylists,
  adminGetPlaylist,
  adminGetPresentation,
  adminLock,
  adminUnlock,
  adminGetLock,
} from "../api";

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

export default function AdminPanel({ pin, onLogout }: Props) {
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [locked, setLocked] = useState<LockedInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadLock = useCallback(async () => {
    try {
      const data = await adminGetLock(pin);
      setLocked(data.locked || null);
    } catch {
      /* ignore */
    }
  }, [pin]);

  useEffect(() => {
    loadPlaylists();
    loadLock();
  }, [loadLock]);

  async function loadPlaylists() {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetPlaylists(pin);
      setPlaylists(data || []);
    } catch {
      setError("Cannot connect to ProPresenter. Is the API enabled?");
    } finally {
      setLoading(false);
    }
  }

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
      setError("Failed to lock presentation");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    try {
      await adminUnlock(pin);
      setLocked(null);
    } catch {
      setError("Failed to unlock");
    }
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Admin</h1>
        <button className="btn-small" onClick={onLogout}>
          Logout
        </button>
      </header>

      <div className="lock-status">
        {locked ? (
          <div className="locked-info">
            <span>
              Locked: <strong>{locked.name}</strong> ({locked.slideCount} slides)
            </span>
            <button className="btn-danger" onClick={handleUnlock}>
              Unlock
            </button>
          </div>
        ) : (
          <p className="muted">No presentation locked for speaker</p>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <h2>Playlists</h2>
      {loading && !playlists.length && <p className="muted">Loading...</p>}

      <ul className="playlist-list">
        {playlists.map((pl) => (
          <li key={pl.id.uuid}>
            <button
              className="playlist-toggle"
              onClick={() => togglePlaylist(pl.id.uuid)}
            >
              {expandedPlaylist === pl.id.uuid ? "v" : ">"} {pl.id.name}
            </button>

            {expandedPlaylist === pl.id.uuid && (
              <ul className="playlist-items">
                {playlistItems.length === 0 && (
                  <li className="muted">No items</li>
                )}
                {playlistItems
                  .filter((item) => item.type === "presentation")
                  .map((item, i) => {
                    const presUuid =
                      item.presentation_info?.presentation_uuid ||
                      item.id.uuid;
                    return (
                      <li key={presUuid || i} className="playlist-item">
                        <span>{item.id?.name || "Untitled"}</span>
                        <button
                          className="btn-lock"
                          onClick={() =>
                            handleLock(presUuid, item.id.name)
                          }
                          disabled={locked?.uuid === presUuid}
                        >
                          {locked?.uuid === presUuid ? "Locked" : "Lock"}
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
