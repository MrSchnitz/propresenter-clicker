import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  speakerAuth,
  speakerGetPresentation,
  speakerGetStatus,
  speakerTriggerSlide,
  speakerSlideThumbUrl,
  speakerClear,
} from "../api";
import { useI18n } from "../i18n";
import LanguageToggle from "./LanguageToggle";
import DvdBouncer from "./DvdBouncer";
import SpeakerLogin from "./SpeakerLogin";

const SPEAKER_PIN_STORAGE_KEY = "speakerAuth";
const SPEAKER_PIN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type StoredSpeakerAuth = { pin: string; expiresAt: number };

type Presentation = { uuid: string; name: string; slideCount: number };
type PresentationData = { locked: boolean; presentations: Presentation[] };
// Which slide is live: a specific slide index within a specific presentation.
type ActiveSlide = { uuid: string; index: number };

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
  const { t, plural } = useI18n();
  const [auth, setAuth] = useState<AuthState>("unknown");
  const [data, setData] = useState<PresentationData | null>(null);
  const [active, setActive] = useState<ActiveSlide | null>(null);
  const activeSlideRef = useRef<HTMLButtonElement | null>(null);

  const presentations = useMemo(() => data?.presentations ?? [], [data]);

  // Probe the server on mount: if no PIN is required, sail through; if one is
  // required, try the stored PIN before falling back to the login screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = loadStoredSpeakerPin();
      try {
        const res = await speakerAuth(stored);
        if (cancelled) return;
        if (res?.required) {
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
      const res = await speakerGetPresentation(auth.pin);
      setData(res);
    } catch (err) {
      if (handleAuthError(err)) return;
      /* offline */
    }
  }, [auth, handleAuthError]);

  const pollStatus = useCallback(async () => {
    if (auth === "unknown" || auth.pin === "") return;
    try {
      const status = await speakerGetStatus(auth.pin);
      // A successful status response with no slide_index means ProPresenter has
      // nothing live (cleared, in PP or via our Clear button) — drop the
      // highlight. (Fetch/auth failures throw and are handled below, so this
      // only fires on a genuine "nothing is showing" signal.)
      if (status?.slide_index === undefined) {
        setActive((prev) => (prev === null ? prev : null));
        return;
      }
      const idx: number = status.slide_index;
      const uuid: unknown = status.presentation_id;
      setActive((prev) => {
        let next: ActiveSlide | null;
        // Prefer the presentation ProPresenter reports, if it's one we know.
        if (typeof uuid === "string" && presentations.some((p) => p.uuid === uuid)) {
          next = { uuid, index: idx };
        } else if (prev) {
          // Otherwise keep highlighting within the last-triggered presentation.
          next = { uuid: prev.uuid, index: idx };
        } else {
          next = prev;
        }
        // Return the SAME reference when nothing changed so the scroll-into-view
        // effect doesn't fire on every poll and yank the user back while they're
        // scrolling through another presentation.
        if (prev && next && prev.uuid === next.uuid && prev.index === next.index) {
          return prev;
        }
        return next;
      });
    } catch (err) {
      handleAuthError(err);
    }
  }, [auth, handleAuthError, presentations]);

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
  }, [active]);

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

  async function handleTrigger(uuid: string, index: number) {
    setActive({ uuid, index });
    try {
      await speakerTriggerSlide(uuid, index, pin);
    } catch (err) {
      handleAuthError(err);
    }
  }

  // The presentation the live slide belongs to, and where we are within it.
  // Next/Previous stay inside the current presentation — at its last (or first)
  // slide the button stops rather than jumping into the neighbouring
  // presentation. Switching presentations is done by tapping a slide.
  const activePres = active
    ? presentations.find((p) => p.uuid === active.uuid) ?? null
    : null;
  const atPresentationStart = !!active && active.index <= 0;
  const atPresentationEnd =
    !!active && !!activePres && active.index >= activePres.slideCount - 1;

  function handleNext() {
    if (!active || !activePres) {
      // Nothing live yet — start at the first slide of the first presentation.
      const first = presentations[0];
      if (first && first.slideCount > 0) handleTrigger(first.uuid, 0);
      return;
    }
    if (!atPresentationEnd) handleTrigger(active.uuid, active.index + 1);
  }

  function handlePrevious() {
    if (!active || !activePres) return;
    if (!atPresentationStart) handleTrigger(active.uuid, active.index - 1);
  }

  // Clear All in ProPresenter — blanks the live output. Drop the local highlight
  // optimistically so the speaker sees nothing is live.
  async function handleClear() {
    setActive(null);
    try {
      await speakerClear(pin);
    } catch (err) {
      handleAuthError(err);
    }
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

  if (!data || !data.locked || presentations.length === 0) {
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

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-10 flex items-center gap-3 border-b border-white/[0.08] bg-surface px-4 py-2">
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
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleClear}
            className={`rounded-app border border-accent px-3 py-1 text-sm font-semibold active:opacity-80 ${
              active ? "bg-accent text-white" : "text-accent"
            }`}
          >
            {t("clearScreen")}
          </button>
          <LanguageToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-20">
        {presentations.map((p) => (
          <section key={p.uuid}>
            <h2 className="sticky top-0 z-[5] flex items-baseline gap-2 border-b border-white/[0.08] bg-surface/95 px-4 py-2 backdrop-blur">
              <span className="min-w-0 flex-1 truncate text-base font-semibold">
                {p.name}
              </span>
              <span className="text-xs text-fg-muted">
                {p.slideCount} {plural("slides", p.slideCount)}
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-2 p-2 min-[480px]:grid-cols-2 md:grid-cols-3 md:gap-3 md:p-3 lg:grid-cols-4">
              {Array.from({ length: p.slideCount }, (_, index) => {
                const isActive =
                  active?.uuid === p.uuid && active?.index === index;
                return (
                  <button
                    key={index}
                    ref={isActive ? activeSlideRef : null}
                    onClick={() => handleTrigger(p.uuid, index)}
                    className={`relative overflow-hidden rounded-app border-[3px] bg-card p-0 transition-colors ${
                      isActive
                        ? "border-success shadow-[0_0_12px_rgba(0,214,114,0.3)]"
                        : "border-transparent"
                    }`}
                  >
                    <img
                      src={speakerSlideThumbUrl(p.uuid, index, 400, pin)}
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
          </section>
        ))}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-white/10 bg-surface px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          onClick={handlePrevious}
          disabled={atPresentationStart}
          className="shrink-0 min-w-[84px] rounded-app bg-accent px-4 py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
        >
          {t("previous")}
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          {active && activePres ? (
            <>
              <span className="text-sm tabular-nums text-fg-muted">
                {active.index + 1} / {activePres.slideCount}
              </span>
              {atPresentationEnd && (
                <span className="mt-0.5 text-xs font-semibold text-accent">
                  {t("lastSlide")}
                </span>
              )}
            </>
          ) : (
            <span className="truncate text-sm text-fg-muted">
              {t("selectSlide")}
            </span>
          )}
        </div>
        <button
          onClick={handleNext}
          disabled={atPresentationEnd}
          className="shrink-0 min-w-[84px] rounded-app bg-accent px-4 py-3 text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
        >
          {t("next")}
        </button>
      </nav>
    </div>
  );
}
