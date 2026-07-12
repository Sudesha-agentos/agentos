import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

function headers(extra = {}) {
  return { ...authHeaders(), ...extra };
}

const restQaAdapter = {
  coverage: () => fetchJson(apiPath("/api/qa/coverage"), { headers: headers() }),
  heatmap: () => fetchJson(apiPath("/api/qa/heatmap"), { headers: headers() }),
  failures: () => fetchJson(apiPath("/api/qa/failures"), { headers: headers() }),
  inbox: () => fetchJson(apiPath("/api/qa/inbox"), { headers: headers() }),
  reports: () => fetchJson(apiPath("/api/qa/pipeline-reports"), { headers: headers() }),
  report: (pipelineId) =>
    fetchJson(apiPath(`/api/qa/pipeline-reports/${pipelineId}`), { headers: headers() }),
  pipelineReports: () =>
    fetchJson(apiPath("/api/qa/pipeline-reports"), { headers: headers() }),
  pipelineReport: (pipelineId) =>
    fetchJson(apiPath(`/api/qa/pipeline-reports/${pipelineId}`), { headers: headers() }),
};

const mockQaAdapter = {
  coverage: () => mockApi.qaCoverage(),
  heatmap: () => mockApi.qaHeatmap(),
  failures: () => mockApi.qaFailures(),
  inbox: () => mockApi.qaInbox?.() ?? Promise.resolve({ running: [], blocked: [], completed: [] }),
  reports: () => mockApi.qaReports(),
  report: (ticketId) => mockApi.qaReport(ticketId),
  pipelineReports: () => mockApi.qaReports(),
  pipelineReport: (pipelineId) => mockApi.qaReport(pipelineId),
};

export const qaAdapter = DATA_MODE === "rest" ? restQaAdapter : mockQaAdapter;

export function useQaCoverage(options = {}) {
  return useResource(() => qaAdapter.coverage(), [], { pollMs: options.pollMs });
}

export function useQaHeatmap(options = {}) {
  return useResource(() => qaAdapter.heatmap(), [], { pollMs: options.pollMs });
}

export function useQaFailures(options = {}) {
  return useResource(() => qaAdapter.failures(), [], { pollMs: options.pollMs });
}

export function useQaInbox(options = {}) {
  return useResource(() => qaAdapter.inbox(), [], { pollMs: options.pollMs });
}

export function useQaReports(options = {}) {
  return useResource(() => qaAdapter.reports(), [], { pollMs: options.pollMs });
}

export function useQaPipelineReport(pipelineId, options = {}) {
  return useResource(
    () => (pipelineId ? qaAdapter.pipelineReport(pipelineId) : Promise.resolve(null)),
    [pipelineId],
    { pollMs: options.pollMs }
  );
}
