import { useState, FormEvent } from "react";
import { speakerAuth } from "../api";
import { useI18n } from "../i18n";
import LanguageToggle from "./LanguageToggle";

interface Props {
  onAuth: (pin: string) => void;
}

export default function SpeakerLogin({ onAuth }: Props) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await speakerAuth(pin);
      onAuth(pin);
    } catch {
      setError(t("invalidPin"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-5">
      <div className="fixed top-[max(12px,env(safe-area-inset-top))] right-3 z-10">
        <LanguageToggle />
      </div>
      <h1 className="mb-6 text-2xl">{t("speakerLoginTitle")}</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-[300px] flex-col gap-3">
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={t("enterPin")}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
          className="rounded-app border-2 border-accent-soft bg-surface p-3.5 text-center text-lg tracking-[8px] text-fg outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !pin}
          className="rounded-app bg-accent p-3.5 font-semibold text-white disabled:opacity-50"
        >
          {loading ? t("checking") : t("login")}
        </button>
        {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      </form>
    </div>
  );
}
