import { useEffect, useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { DATA_MODE, DATA_MODES } from "../config/app";
import {
  isBackendReady,
  retryWaitForBackend,
  waitForBackend,
} from "../lib/backendReady";
import { opensWithoutApi } from "../routing/publicPaths";
import BackendConnectingScreen from "./BackendConnectingScreen";

function removeInitialLoader() {
  document.getElementById("app-initial-loader")?.remove();
  document.getElementById("root")?.classList.add("app-ready");
}

function shouldSkipApiWait(pathname) {
  if (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test") {
    return true;
  }
  if (DATA_MODE !== DATA_MODES.REST) return true;
  return opensWithoutApi(pathname);
}

export default function AppBootstrapGate({ children }) {
  const { pathname } = useLocation();
  const skipApiWait = shouldSkipApiWait(pathname);
  const [apiReady, setApiReady] = useState(() => skipApiWait || isBackendReady());
  const [elapsedSec, setElapsedSec] = useState(0);

  useLayoutEffect(() => {
    if (skipApiWait || isBackendReady()) {
      removeInitialLoader();
      setApiReady(true);
      return undefined;
    }

    setApiReady(false);
    setElapsedSec(0);
    let cancelled = false;
    void waitForBackend().then(() => {
      if (cancelled) return;
      removeInitialLoader();
      setApiReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [skipApiWait]);

  useEffect(() => {
    if (apiReady || skipApiWait) return undefined;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [apiReady, skipApiWait]);

  const onRetry = () => {
    setElapsedSec(0);
    void retryWaitForBackend().then(() => {
      removeInitialLoader();
      setApiReady(true);
    });
  };

  if (!skipApiWait && !apiReady) {
    return (
      <>
        <BackendConnectingScreen elapsedSec={elapsedSec} onRetry={onRetry} />
        <div className="app-boot-hidden">{children}</div>
      </>
    );
  }

  return <div className="app-boot-visible">{children}</div>;
}
