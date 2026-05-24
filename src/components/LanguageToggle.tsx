import { useI18n, Lang } from "../i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const opts: Lang[] = ["cs", "en"];
  return (
    <div
      className="inline-flex gap-0.5 rounded-app border border-white/10 bg-surface p-0.5"
      role="group"
      aria-label="Language"
    >
      {opts.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`rounded-[6px] px-2 py-1 text-[11px] font-bold tracking-wider transition-colors ${
            lang === l
              ? "bg-accent text-white"
              : "bg-transparent text-fg-muted hover:text-fg"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
