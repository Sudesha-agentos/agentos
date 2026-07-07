import { useEffect, useState } from "react";
import AppPreloader from "./AppPreloader";

const MIN_BOOT_MS = 0;

function removeInitialLoader() {
  document.getElementById("app-initial-loader")?.remove();
  document.getElementById("root")?.classList.add("app-ready");
}

export default function AppBootstrapGate({ children }) {
  const [docReady, setDocReady] = useState(
    () => document.readyState === "complete" || document.readyState === "interactive"
  );
  const [minElapsed, setMinElapsed] = useState(false);
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

  // Don't block the public marketing shell on auth/session checks — those can hang
  // when the API is down or slow while a stale token exists in localStorage.
  const booting = !docReady || !minElapsed;

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
        <AppPreloader overlay exiting={exiting} label="Loading AgentOX" />
      ) : null}
      <div className={showApp ? "app-boot-visible" : "app-boot-hidden"}>{children}</div>
    </>
  );
}
