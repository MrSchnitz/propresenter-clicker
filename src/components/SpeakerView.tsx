import { useState, useEffect, useCallback, useRef } from "react";
import {
  speakerAuth,
  speakerGetPresentation,
  speakerGetStatus,
  speakerTriggerSlide,
  speakerNext,
  speakerPrevious,
  speakerSlideThumbUrl,
} from "../api";
import { useI18n } from "../i18n";
import LanguageToggle from "./LanguageToggle";
import DvdBouncer from "./DvdBouncer";
import SpeakerLogin from "./SpeakerLogin";

const SPEAKER_PIN_STORAGE_KEY = "speakerAuth";
const SPEAKER_PIN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type StoredSpeakerAuth = { pin: string; expiresAt: number };

function loadStoredSpeakerPin(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SPEAKER_PIN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSpeakerAuth;
    if (typeof parsed.pin === "string" && parsed.expiresAt > Date.now()) {
      return parsed.pin;
    }
  } catch {
    /* malformed — fall through to clear */
  }
  window.localStorage.removeItem(SPEAKER_PIN_STORAGE_KEY);
  return null;
}

function storeSpeakerPin(pin: string) {
  const entry: StoredSpeakerAuth = {
    pin,
    expiresAt: Date.now() + SPEAKER_PIN_TTL_MS,
  };
  window.localStorage.setItem(SPEAKER_PIN_STORAGE_KEY, JSON.stringify(entry));
}

function clearStoredSpeakerPin() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SPEAKER_PIN_STORAGE_KEY);
}

// "unknown" while we check whether a PIN is required; null = no PIN required;
// string = authenticated with this PIN.
type AuthState = "unknown" | { pin: string | null };

export default function SpeakerView() {
  const { t } = useI18n();
  const [auth, setAuth] = useState<AuthState>("unknown");
  const [presentation, setPresentation] = useState<{
    locked: boolean;
    uuid?: string;
    name?: string;
    slideCount?: number;
  } | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(-1);
  const activeSlideRef = useRef<HTMLButtonElement | null>(null);

  // Probe the server on mount: if no PIN is required, sail through; if one is
  // required, try the stored PIN before falling back to the login screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = loadStoredSpeakerPin();
      try {
        const data = await speakerAuth(stored);
        if (cancelled) return;
        if (data?.required) {
          setAuth({ pin: stored });
        } else {
          setAuth({ pin: null });
        }
      } catch {
        if (cancelled) return;
        clearStoredSpeakerPin();
        setAuth({ pin: "" }); // triggers login screen below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If any speaker call returns 401 the admin probably set/changed the PIN.
  // Wipe local state so the user is sent back to the login screen.
  const handleAuthError = useCallback((err: unknown) => {
    if (err instanceof Error && /HTTP 401|Speaker PIN/i.test(err.message)) {
      clearStoredSpeakerPin();
      setAuth({ pin: "" });
      return true;
    }
    return false;
  }, []);

  const loadPresentation = useCallback(async () => {
    if (auth === "unknown" || auth.pin === "") return;
    try {
      const data = await speakerGetPresentation(auth.pin);
      setPresentation(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      /* offline */
    }
  }, [auth, handleAuthError]);

  const pollStatus = useCallback(async () => {
    if (auth === "unknown" || auth.pin === "") return;
    try {
      const data = await speakerGetStatus(auth.pin);
      if (data?.slide_index !== undefined) {
        setActiveSlideIndex(data.slide_index);
      }
    } catch (err) {
      handleAuthError(err);
    }
  }, [auth, handleAuthError]);

  useEffect(() => {
    if (auth === "unknown" || auth.pin === "") return;
    loadPresentation();
    const presInterval = setInterval(loadPresentation, 3000);
    return () => clearInterval(presInterval);
  }, [auth, loadPresentation]);

  useEffect(() => {
    if (auth === "unknown" || auth.pin === "") return;
    pollStatus();
    const statusInterval = setInterval(pollStatus, 2000);
    return () => clearInterval(statusInterval);
  }, [auth, pollStatus]);

  useEffect(() => {
    activeSlideRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSlideIndex]);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  const pin = auth !== "unknown" ? auth.pin : null;

  async function handleTrigger(index: number) {
    setActiveSlideIndex(index);
    try {
      await speakerTriggerSlide(index, pin);
    } catch (err) {
      handleAuthError(err);
    }
  }

  async function handleNext() {
    setActiveSlideIndex((prev) => prev + 1);
    try {
      await speakerNext(pin);
    } catch (err) {
      if (handleAuthError(err)) return;
    }
    setTimeout(pollStatus, 500);
  }

  async function handlePrevious() {
    setActiveSlideIndex((prev) => Math.max(0, prev - 1));
    try {
      await speakerPrevious(pin);
    } catch (err) {
      if (handleAuthError(err)) return;
    }
    setTimeout(pollStatus, 500);
  }

  function handleSpeakerAuth(p: string) {
    storeSpeakerPin(p);
    setAuth({ pin: p });
  }

  if (auth === "unknown") {
    return <div className="flex min-h-dvh items-center justify-center" />;
  }

  if (auth.pin === "") {
    return <SpeakerLogin onAuth={handleSpeakerAuth} />;
  }

  if (!presentation || !presentation.locked) {
    return (
      <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden p-5 text-center">
        {/* Ambient drifting orbs — deepest layer */}
        <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
          <div className="absolute -top-32 -left-24 h-80 w-80 animate-drift1 rounded-full bg-accent/25 blur-3xl" />
          <div className="absolute top-1/3 -right-24 h-96 w-96 animate-drift2 rounded-full bg-accent-soft/30 blur-3xl" />
          <div className="absolute -bottom-32 left-1/4 h-80 w-80 animate-drift3 rounded-full bg-success/15 blur-3xl" />
        </div>

        <DvdBouncer />

        <div className="fixed top-[max(12px,env(safe-area-inset-top))] right-3 z-10">
          <LanguageToggle />
        </div>
        <h1 className="mb-2 text-[22px]">ProPresenter clicker</h1>
        <p className="mb-8 max-w-[320px] text-sm italic text-fg-muted">
          {t("slogan")}
        </p>
        <p className="text-base text-fg-muted">{t("waiting")}</p>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 animate-bounce rounded-full bg-fg-muted [animation-delay:-300ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-fg-muted [animation-delay:-150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-fg-muted" />
        </div>
      </div>
    );
  }

  const slides = Array.from({ length: presentation.slideCount || 0 }, (_, i) => i);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-surface px-4 py-3">
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
          {presentation.name}
        </h1>
        <LanguageToggle />
      </header>

      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.08] bg-surface px-4 py-2">
        <span className="font-mono text-2xl tabular-nums">
          {formatTime(timerSeconds)}
        </span>
        <button
          onClick={() => setTimerRunning((r) => !r)}
          className="rounded-app bg-accent px-3 py-1 text-sm font-semibold text-white active:opacity-80"
        >
          {timerRunning ? "⏸" : "▶"}
        </button>
        <button
          onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}
          className="rounded-app border border-white/20 px-3 py-1 text-sm text-fg-muted active:opacity-80"
        >
          ↺
        </button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 pb-20 min-[480px]:grid-cols-2 md:grid-cols-3 md:gap-3 md:p-3 lg:grid-cols-4">
        {slides.map((index) => {
          const isActive = index === activeSlideIndex;
          return (
            <button
              key={index}
              ref={isActive ? activeSlideRef : null}
              onClick={() => handleTrigger(index)}
              className={`relative overflow-hidden rounded-app border-[3px] bg-card p-0 transition-colors ${
                isActive
                  ? "border-success shadow-[0_0_12px_rgba(0,214,114,0.3)]"
                  : "border-transparent"
              }`}
            >
              <img
                src={speakerSlideThumbUrl(index, 400, pin)}
                alt={`${t("slide")} ${index + 1}`}
                loading="lazy"
                className="block aspect-video w-full bg-black object-cover"
              />
              <span className="absolute top-1.5 left-1.5 min-w-[28px] rounded-md bg-black/75 px-2 py-1 text-center text-base font-bold tabular-nums text-white shadow-md">
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>

      <nav className="fixed inset-x-0 bottom-0 flex items-center justify-between border-t border-white/10 bg-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          onClick={handlePrevious}
          className="min-w-[100px] rounded-app bg-accent px-6 py-3 text-[15px] font-semibold text-white active:opacity-80"
        >
          {t("previous")}
        </button>
        <span className="text-sm tabular-nums text-fg-muted">
          {activeSlideIndex + 1} / {presentation.slideCount}
        </span>
        <button
          onClick={handleNext}
          className="min-w-[100px] rounded-app bg-accent px-6 py-3 text-[15px] font-semibold text-white active:opacity-80"
        >
          {t("next")}
        </button>
      </nav>
    </div>
  );
}
