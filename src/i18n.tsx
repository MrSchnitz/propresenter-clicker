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
    ppNotConnected: "ProPresenter neběží",
    ppNotConnectedHelp: "Otevřete ProPresenter na hostitelském počítači a v Předvolbách → Síť povolte Remote a zkontrolujte heslo.",
    failedToLock: "Nepodařilo se vybrat prezentaci",
    failedToUnlock: "Nepodařilo se zrušit výběr",
    lockedLabel: "Vybráno",
    unlock: "Zrušit výběr",
    noPresentationLocked: "Pro řečníka není vybrána žádná prezentace",
    playlists: "Playlisty",
    loading: "Načítám...",
    noItems: "Žádné položky",
    untitled: "Bez názvu",
    lock: "Vybrat",
    lockPlaylist: "Vybrat celý playlist",
    add: "Přidat",
    unselect: "Odebrat",
    remove: "Odebrat",
    clearAll: "Smazat vše",
    chosenPresentations: "Vybrané prezentace",

    // SpeakerView
    slogan: "Protože hardwarový presenter to nedává...",
    waiting: "Čekám, až admin vybere prezentaci...",
    previous: "Předchozí",
    next: "Další",
    slide: "Snímek",
    lastSlide: "Poslední snímek",
    selectSlide: "Vyberte snímek",
    clearScreen: "Vymazat",

    // SpeakerLogin / speaker PIN admin section
    speakerLoginTitle: "Přihlášení řečníka",
    speakerPinSection: "PIN řečníka",
    speakerPinHelp: "Volitelný PIN pro přístup do zobrazení řečníka.",
    speakerPinIsSet: "PIN je nastaven.",
    speakerPinNotSet: "Žádný PIN — zobrazení řečníka je otevřené.",
    speakerPinPlaceholder: "Nový PIN",
    save: "Uložit",
    clear: "Smazat",
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
    ppNotConnected: "ProPresenter is not running",
    ppNotConnectedHelp: "Open ProPresenter on the host machine and enable Preferences → Network → Remote, then check the password.",
    failedToLock: "Failed to choose presentation",
    failedToUnlock: "Failed to clear selection",
    lockedLabel: "Chosen",
    unlock: "Clear",
    noPresentationLocked: "No presentation chosen for speaker",
    playlists: "Playlists",
    loading: "Loading...",
    noItems: "No items",
    untitled: "Untitled",
    lock: "Choose",
    lockPlaylist: "Choose whole playlist",
    add: "Add",
    unselect: "Unselect",
    remove: "Remove",
    clearAll: "Clear all",
    chosenPresentations: "Chosen presentations",

    slogan: "Because hardware clicker is too lame...",
    waiting: "Waiting for admin to select a presentation...",
    previous: "Previous",
    next: "Next",
    slide: "Slide",
    lastSlide: "Last slide",
    selectSlide: "Select a slide",
    clearScreen: "Clear",

    speakerLoginTitle: "Speaker Login",
    speakerPinSection: "Speaker PIN",
    speakerPinHelp: "Optional PIN required to access the speaker view.",
    speakerPinIsSet: "PIN is set.",
    speakerPinNotSet: "No PIN — speaker view is open.",
    speakerPinPlaceholder: "New PIN",
    save: "Save",
    clear: "Clear",
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
