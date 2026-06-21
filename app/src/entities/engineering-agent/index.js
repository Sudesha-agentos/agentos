import { useEffect, useRef } from "react";
import { DATA_MODE } from "../../shared/config/app";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restAdapter = {
  listRuns: () =>
    fetchJson(apiPath("/api/engineering/runs"), { headers: authHeaders() }),
  getRun: (id) =>
    fetchJson(apiPath(`/api/engineering/runs/${encodeURIComponent(id)}`), {
      headers: authHeaders(),
    }),
};

const mockAdapter = {
  listRuns: () => mockApi.listEngineeringRuns(),
  getRun: (id) => mockApi.getEngineeringRun(id),
};

export const engineeringAgentAdapter =
  DATA_MODE === "rest" ? restAdapter : mockAdapter;

export function useEngineeringRuns(options = {}) {
  const { data, loading, error, refresh } = useResource(
    () => engineeringAgentAdapter.listRuns(),
    [],
    { pollMs: options.pollMs ?? 15_000 }
  );
  return { items: data?.items ?? [], loading, error, refresh };
}

export function useEngineeringRun(pipelineId, options = {}) {
  const pollMs =
    options.pollMs ?? (pipelineId ? (options.live ? 2_500 : 8_000) : 0);
  const { data, loading, error, refresh } = useResource(
    () =>
      pipelineId
        ? engineeringAgentAdapter.getRun(pipelineId)
        : Promise.resolve(null),
    [pipelineId],
    { pollMs }
  );
  return { run: data, loading, error, refresh };
}

/** Subscribe to live coding SSE events for a pipeline (REST mode only). */
export function useEngineeringCodingEvents(pipelineId, { enabled = true, onEvent } = {}) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !pipelineId || DATA_MODE !== "rest") return undefined;
    const url = apiPath(`/api/engineering/runs/${encodeURIComponent(pipelineId)}/events`);
    const headers = authHeaders();
    let closed = false;
    let es = null;

    (async () => {
      try {
        const res = await fetch(url, { headers });
        if (!res.ok || !res.body || closed) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              onEventRef.current?.(payload);
            } catch {
              /* ignore malformed */
            }
          }
        }
      } catch {
        /* stream ended or unavailable */
      }
    })();

    return () => {
      closed = true;
      es?.close?.();
    };
  }, [enabled, pipelineId]);
}
