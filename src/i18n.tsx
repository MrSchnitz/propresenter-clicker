import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Lang = "cs" | "en";

type Dict = Record<string, string>;

const translations: Record<Lang, Dict> = {
  cs: {
    // AdminLogin
    loginTitle: "Přihlášení admina",
    enterPin: "Zadejte PIN",
    checking: "Ověřuji...",
    login: "Přihlásit",
    invalidPin: "Neplatný PIN",

    // AdminPanel
    admin: "Admin",
    logout: "Odhlásit",
    cannotConnect: "Nelze se připojit k ProPresenteru. Je API zapnuté?",
    failedToLock: "Nepodařilo se zamknout prezentaci",
    failedToUnlock: "Nepodařilo se odemknout",
    lockedLabel: "Zamčeno",
    unlock: "Odemknout",
    noPresentationLocked: "Pro řečníka není zamčená žádná prezentace",
    playlists: "Playlisty",
    loading: "Načítám...",
    noItems: "Žádné položky",
    untitled: "Bez názvu",
    lock: "Zamknout",

    // SpeakerView
    slogan: "Protože hardwarový presenter to nedává...",
    waiting: "Čekám, až admin vybere prezentaci...",
    previous: "Předchozí",
    next: "Další",
    slide: "Snímek",
  },
  en: {
    loginTitle: "Admin Login",
    enterPin: "Enter PIN",
    checking: "Checking...",
    login: "Login",
    invalidPin: "Invalid PIN",

    admin: "Admin",
    logout: "Logout",
    cannotConnect: "Cannot connect to ProPresenter. Is the API enabled?",
    failedToLock: "Failed to lock presentation",
    failedToUnlock: "Failed to unlock",
    lockedLabel: "Locked",
    unlock: "Unlock",
    noPresentationLocked: "No presentation locked for speaker",
    playlists: "Playlists",
    loading: "Loading...",
    noItems: "No items",
    untitled: "Untitled",
    lock: "Lock",

    slogan: "Because hardware clicker is too lame...",
    waiting: "Waiting for admin to select a presentation...",
    previous: "Previous",
    next: "Next",
    slide: "Slide",
  },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof translations.cs) => string;
  plural: (key: "slides", n: number) => string;
};

const I18nContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "lang";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "cs";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "cs" || stored === "en") return stored;
  const nav = navigator.language?.toLowerCase() ?? "";
  return nav.startsWith("cs") ? "cs" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const ctx: Ctx = {
    lang,
    setLang: setLangState,
    t: (key) => translations[lang][key] ?? String(key),
    plural: (key, n) => {
      if (key === "slides") {
        if (lang === "cs") {
          if (n === 1) return "snímek";
          if (n >= 2 && n <= 4) return "snímky";
          return "snímků";
        }
        return n === 1 ? "slide" : "slides";
      }
      return "";
    },
  };

  return <I18nContext.Provider value={ctx}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
