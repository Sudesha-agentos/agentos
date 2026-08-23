import { useEffect, useState } from "react";
import { isBackendReady, subscribeBackendReady, waitForBackend } from "./backendReady";

export function useBackendReady() {
  const [ready, setReady] = useState(() => isBackendReady());

  useEffect(() => {
    void waitForBackend();
    return subscribeBackendReady(setReady);
  }, []);

  return ready;
}
