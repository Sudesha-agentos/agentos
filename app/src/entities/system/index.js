import { ReadinessResponseSchema } from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restSystemAdapter = {
  async readiness() {
    return ReadinessResponseSchema.parse(
      await fetchJson(apiPath("/api", "/readyz"))
    );
  },
};

const mockSystemAdapter = {
  async readiness() {
    return ReadinessResponseSchema.parse(await mockApi.readiness());
  },
};

export const systemAdapter =
  DATA_MODE === "rest" ? restSystemAdapter : mockSystemAdapter;

export function useReadiness(options = {}) {
  return useResource(() => systemAdapter.readiness(), [], {
    pollMs: options.pollMs ?? 15000,
  });
}
