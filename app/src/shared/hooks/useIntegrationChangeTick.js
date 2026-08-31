import { useEffect, useState } from "react";
import { INTEGRATIONS_CHANGED } from "../lib/chromeEvents";

/** Bumps when the top-bar Refresh Jira / GitHub action finishes so lists reload once. */
export function useIntegrationChangeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    function onChanged() {
      setTick((n) => n + 1);
    }
    window.addEventListener(INTEGRATIONS_CHANGED, onChanged);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED, onChanged);
  }, []);
  return tick;
}
