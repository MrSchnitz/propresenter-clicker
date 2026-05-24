import { Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import AdminLogin from "./components/AdminLogin";
import AdminPanel from "./components/AdminPanel";
import SpeakerView from "./components/SpeakerView";
import { adminAuth } from "./api";

const PIN_STORAGE_KEY = "adminAuth";
const PIN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type StoredAuth = { pin: string; expiresAt: number };

function loadStoredPin(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (typeof parsed.pin === "string" && parsed.expiresAt > Date.now()) {
      return parsed.pin;
    }
  } catch {
    /* malformed — fall through to clear */
  }
  window.localStorage.removeItem(PIN_STORAGE_KEY);
  return null;
}

function AdminPage() {
  const [pin, setPin] = useState<string | null>(loadStoredPin);

  // Validate the persisted PIN on mount — if the server PIN changed, clear it
  // so the user gets the login screen instead of an admin panel that 401s.
  useEffect(() => {
    if (!pin) return;
    let alive = true;
    adminAuth(pin).catch(() => {
      if (!alive) return;
      window.localStorage.removeItem(PIN_STORAGE_KEY);
      setPin(null);
    });
    return () => {
      alive = false;
    };
    // Intentionally only runs on mount — re-validation on every PIN change
    // would re-fire after login (already validated via adminAuth there).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-logout when the stored credential expires while the page is open.
  useEffect(() => {
    if (!pin) return;
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return;
    let expiresAt: number;
    try {
      expiresAt = (JSON.parse(raw) as StoredAuth).expiresAt;
    } catch {
      return;
    }
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      handleLogout();
      return;
    }
    const timer = window.setTimeout(handleLogout, remaining);
    return () => window.clearTimeout(timer);
  }, [pin]);

  function handleAuth(p: string) {
    const entry: StoredAuth = { pin: p, expiresAt: Date.now() + PIN_TTL_MS };
    window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(entry));
    setPin(p);
  }

  function handleLogout() {
    window.localStorage.removeItem(PIN_STORAGE_KEY);
    setPin(null);
  }

  if (!pin) {
    return <AdminLogin onAuth={handleAuth} />;
  }

  return <AdminPanel pin={pin} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SpeakerView />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
