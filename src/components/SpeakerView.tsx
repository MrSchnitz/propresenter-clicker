import { useState, useEffect, useCallback, useRef } from "react";
import {
  speakerGetPresentation,
  speakerGetStatus,
  speakerTriggerSlide,
  speakerNext,
  speakerPrevious,
  speakerSlideThumbUrl,
} from "../api";

export default function SpeakerView() {
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

  // Poll for presentation changes (every 3s) and active slide (every 2s)
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

  // Auto-scroll to active slide
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
      <div className="speaker-waiting">
        <h1>ProPresenter Remote</h1>
        <p>Waiting for admin to select a presentation...</p>
      </div>
    );
  }

  const slides = Array.from({ length: presentation.slideCount || 0 }, (_, i) => i);

  return (
    <div className="speaker-container">
      <header className="speaker-header">
        <h1>{presentation.name}</h1>
      </header>

      <div className="slide-grid">
        {slides.map((index) => (
          <button
            key={index}
            ref={index === activeSlideIndex ? activeSlideRef : null}
            className={`slide-thumb ${index === activeSlideIndex ? "active" : ""}`}
            onClick={() => handleTrigger(index)}
          >
            <img
              src={speakerSlideThumbUrl(index)}
              alt={`Slide ${index + 1}`}
              loading="lazy"
            />
            <span className="slide-number">{index + 1}</span>
          </button>
        ))}
      </div>

      <nav className="speaker-nav">
        <button className="nav-btn" onClick={handlePrevious}>
          Previous
        </button>
        <span className="nav-indicator">
          {activeSlideIndex + 1} / {presentation.slideCount}
        </span>
        <button className="nav-btn" onClick={handleNext}>
          Next
        </button>
      </nav>
    </div>
  );
}
