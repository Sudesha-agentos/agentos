import { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "agentox-workspace-mode";
const WorkspaceModeContext = createContext(null);

function readStoredMode() {
  if (typeof window === "undefined") return "work";
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === "preview" || stored === "work") return stored;
  } catch {
    /* ignore */
  }
  return "work";
}

export function WorkspaceModeProvider({ children }) {
  const [mode, setModeState] = useState(readStoredMode);

  const setMode = useCallback((next) => {
    const value = next === "preview" ? "preview" : "work";
    setModeState(value);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isPreview: mode === "preview",
      setMode,
      setWork: () => setMode("work"),
      setPreview: () => setMode("preview"),
    }),
    [mode, setMode]
  );

  return <WorkspaceModeContext.Provider value={value}>{children}</WorkspaceModeContext.Provider>;
}

export function useWorkspaceMode() {
  const ctx = useContext(WorkspaceModeContext);
  if (!ctx) {
    throw new Error("useWorkspaceMode must be used within WorkspaceModeProvider");
  }
  return ctx;
}
