export type UserPreferences = {
  theme: "dark" | "light";
  defaultLanguage: string;
  automaticDetection: boolean;
};

const storageKey = "lingua-ai-preferences";

export const defaultPreferences: UserPreferences = {
  theme: "dark",
  defaultLanguage: "en",
  automaticDetection: true,
};

export function readPreferences(): UserPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (typeof stored !== "object" || stored === null) return defaultPreferences;
    const value = stored as Partial<UserPreferences>;
    return {
      theme: value.theme === "light" ? "light" : "dark",
      defaultLanguage:
        typeof value.defaultLanguage === "string" ? value.defaultLanguage : defaultPreferences.defaultLanguage,
      automaticDetection: value.automaticDetection !== false,
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: UserPreferences) {
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  document.documentElement.dataset.theme = preferences.theme;
}

export function applyStoredTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = readPreferences().theme;
}
