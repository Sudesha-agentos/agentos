import { AuditListResponseSchema } from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { formatAuditInline } from "../../shared/lib/format";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restAuditAdapter = {
  async list(pipelineId) {
    return AuditListResponseSchema.parse(
      await fetchJson(apiPath("/api", `/pipelines/${pipelineId}/audit`))
    );
  },
};

const mockAuditAdapter = {
  async list(pipelineId) {
    return AuditListResponseSchema.parse(await mockApi.getAudit(pipelineId));
  },
};

export const auditAdapter =
  DATA_MODE === "rest" ? restAuditAdapter : mockAuditAdapter;

export function mapAuditEntry(entry) {
  return {
    ...entry,
    inline: formatAuditInline(entry),
  };
}

export function usePipelineAudit(pipelineId, options = {}) {
  const query = useResource(
    () => auditAdapter.list(pipelineId),
    [pipelineId],
    { pollMs: options.pollMs ?? 12000 }
  );

  return {
    ...query,
    items: (query.data?.items ?? []).map(mapAuditEntry),
  };
}
