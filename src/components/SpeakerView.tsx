import { useState, useEffect, useCallback, useRef } from "react";
import {
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

export default function SpeakerView() {
  const { t } = useI18n();
  const [presentation, setPresentation] = useState<{
    locked: boolean;
    uuid?: string;
    name?: string;
    slideCount?: number;
  } | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(-1);
  const activeSlideRef = useRef<HTMLButtonElement | null>(null);

  const loadPresentation = useCallback(async () => {
    try {
      const data = await speakerGetPresentation();
      setPresentation(data);
    } catch {
      /* offline */
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const data = await speakerGetStatus();
      if (data?.slide_index !== undefined) {
        setActiveSlideIndex(data.slide_index);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadPresentation();
    const presInterval = setInterval(loadPresentation, 3000);
    return () => clearInterval(presInterval);
  }, [loadPresentation]);

  useEffect(() => {
    pollStatus();
    const statusInterval = setInterval(pollStatus, 2000);
    return () => clearInterval(statusInterval);
  }, [pollStatus]);

  useEffect(() => {
    activeSlideRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSlideIndex]);

  async function handleTrigger(index: number) {
    setActiveSlideIndex(index);
    await speakerTriggerSlide(index);
  }

  async function handleNext() {
    setActiveSlideIndex((prev) => prev + 1);
    await speakerNext();
    setTimeout(pollStatus, 500);
  }

  async function handlePrevious() {
    setActiveSlideIndex((prev) => Math.max(0, prev - 1));
    await speakerPrevious();
    setTimeout(pollStatus, 500);
  }

  if (!presentation || !presentation.locked) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-5 text-center">
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
                src={speakerSlideThumbUrl(index)}
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
