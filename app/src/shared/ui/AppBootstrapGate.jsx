import { useEffect, useState } from "react";
import { DATA_MODE, DATA_MODES } from "../config/app";
import { waitForBackend } from "../lib/backendReady";
import AppPreloader from "./AppPreloader";

const MIN_BOOT_MS = 0;
const SLOW_MS = 4000;
const VERY_SLOW_MS = 25000;

function removeInitialLoader() {
  document.getElementById("app-initial-loader")?.remove();
  document.getElementById("root")?.classList.add("app-ready");
}

function bootLabel(apiReady, slow, verySlow) {
  if (apiReady) return "Loading AgentOX";
  if (verySlow) return "Still starting the backend — first visit can take a minute";
  if (slow) return "Waking the AgentOX backend";
  return "Loading AgentOX";
}

export default function AppBootstrapGate({ children }) {
  const skipApiWait = DATA_MODE !== DATA_MODES.REST;
  const [docReady, setDocReady] = useState(
    () => document.readyState === "complete" || document.readyState === "interactive"
  );
  const [minElapsed, setMinElapsed] = useState(false);
  const [apiReady, setApiReady] = useState(skipApiWait);
  const [slow, setSlow] = useState(false);
  const [verySlow, setVerySlow] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinElapsed(true), MIN_BOOT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (docReady) return undefined;
    const markReady = () => setDocReady(true);
    document.addEventListener("DOMContentLoaded", markReady, { once: true });
    window.addEventListener("load", markReady, { once: true });
    return () => {
      document.removeEventListener("DOMContentLoaded", markReady);
      window.removeEventListener("load", markReady);
    };
  }, [docReady]);

  useEffect(() => {
    if (skipApiWait) return undefined;
    let cancelled = false;
    void waitForBackend().then(() => {
      if (!cancelled) setApiReady(true);
    });
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_MS);
    const verySlowTimer = window.setTimeout(() => setVerySlow(true), VERY_SLOW_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
      window.clearTimeout(verySlowTimer);
    };
  }, [skipApiWait]);

  const booting = !docReady || !minElapsed || !apiReady;

  useEffect(() => {
    if (booting) return undefined;

    setExiting(true);
    const revealTimer = window.setTimeout(() => {
      removeInitialLoader();
      setShowApp(true);
    }, 120);

    const unmountTimer = window.setTimeout(() => {
      setOverlayMounted(false);
    }, 280);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [booting]);

  return (
    <>
      {overlayMounted ? (
        <AppPreloader
          overlay
          exiting={exiting}
          label={bootLabel(apiReady, slow, verySlow)}
        />
      ) : null}
      <div className={showApp ? "app-boot-visible" : "app-boot-hidden"}>{children}</div>
    </>
  );
}
