import { useEffect, useRef } from "react";
import { trackEvent } from "./mixpanel";

const IN_PROGRESS = new Set(["RUNNING", "AWAITING_INPUT", "AWAITING_CONFIRMATION"]);
const firedIds = new Set();

export function shouldTrackPrdCompleted({
  prevStatus,
  status,
  generatedPrd,
  id,
  alreadyFired,
}) {
  return (
    status === "COMPLETED" &&
    Boolean(generatedPrd) &&
    IN_PROGRESS.has(prevStatus) &&
    Boolean(id) &&
    !alreadyFired
  );
}

export function useTrackPrdCompleted(analysis) {
  const prevStatus = useRef(undefined);

  useEffect(() => {
    const status = analysis?.status;
    const id = analysis?.id || analysis?.jiraKey;
    if (
      shouldTrackPrdCompleted({
        prevStatus: prevStatus.current,
        status,
        generatedPrd: analysis?.generatedPrd,
        id,
        alreadyFired: firedIds.has(id),
      })
    ) {
      firedIds.add(id);
      const confidence = analysis.generatedPrd?.prdConfidence;
      trackEvent("prd_completed", {
        jira_key: analysis.jiraKey,
        prd_confidence: typeof confidence === "number" ? confidence : undefined,
        platform: "web",
      });
    }
    prevStatus.current = status;
  }, [analysis]);
}
