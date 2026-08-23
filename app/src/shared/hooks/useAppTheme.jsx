import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "agentox-app-theme";

const AppThemeContext = createContext(null);

function prefersDark() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(preference) {
  if (preference === "system") return prefersDark() ? "dark" : "light";
  return preference === "light" ? "light" : "dark";
}

function readStoredTheme() {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch {
    /* ignore */
  }
  return "system";
}

function applyThemeClass(resolved) {
  const root = document.documentElement;
  root.classList.add("app-theme");
  root.classList.toggle("app-theme-dark", resolved === "dark");
  root.style.colorScheme = resolved === "dark" ? "dark" : "light";
}

/**
 * Post-login dashboard theme. Preference is light / dark / system; resolved follows OS when system.
 */
export function AppThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStoredTheme);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : resolveTheme(preference);

  useEffect(() => {
    applyThemeClass(resolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* ignore */
    }
  }, [preference, resolved]);

  const setTheme = useCallback((next) => {
    if (next === "dark" || next === "light" || next === "system") {
      setPreferenceState(next);
      return;
    }
    setPreferenceState("light");
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((prev) => {
      const current = prev === "system" ? (prefersDark() ? "dark" : "light") : prev;
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  const value = useMemo(
    () => ({
      theme: preference,
      preference,
      resolved,
      isDark: resolved === "dark",
      setTheme,
      toggleTheme,
    }),
    [preference, resolved, setTheme, toggleTheme]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return ctx;
}
