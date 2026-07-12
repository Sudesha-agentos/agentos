import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { authHeaders } from "../../shared/lib/authHeaders";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

function headers(extra = {}) {
  return { ...authHeaders(), ...extra };
}

const restCodebaseAdapter = {
  status: (branch) => {
    const qs = branch ? `?branch=${encodeURIComponent(branch)}` : "";
    return fetchJson(apiPath("/api", `/codebase/status${qs}`), { headers: headers() });
  },
  insights: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/insights?branch=${encodeURIComponent(branch)}`), {
      headers: headers(),
    }),
  triggerFullIndex: (branch) =>
    fetchJson(apiPath("/git-integration", "/index/full"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(branch ? { branch } : {}),
    }),
  structure: () => fetchJson(apiPath("/api", "/codebase/structure"), { headers: headers() }),
  branches: () => fetchJson(apiPath("/api", "/codebase/branches"), { headers: headers() }),
  commits: () => fetchJson(apiPath("/api", "/codebase/commits"), { headers: headers() }),
  search: (query, branch = "main") =>
    fetchJson(apiPath("/api/codebase/search"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ query, branchName: branch }),
    }),
  visualization: (branch = "main", refresh = false) => {
    const qs = new URLSearchParams({ branch });
    if (refresh) qs.set("refresh", "true");
    return fetchJson(apiPath("/api", `/codebase/visualization?${qs.toString()}`), {
      headers: headers(),
    });
  },
  fileInterior: (branch, filePath) =>
    fetchJson(
      apiPath(
        "/api",
        `/codebase/visualization/file?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(filePath)}`
      ),
      { headers: headers() }
    ),
  ask: (question, branch = "main") =>
    fetchJson(apiPath("/api/codebase/ask"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ question, branchName: branch }),
    }),
  directory: (dirPath = "", branch = "main") => {
    const qs = new URLSearchParams({ branch });
    if (dirPath) qs.set("path", dirPath);
    return fetchJson(apiPath("/api", `/codebase/directory?${qs.toString()}`), { headers: headers() });
  },
  file: (filePath, branch = "main", includeContent = false) => {
    const qs = new URLSearchParams({ branch, path: filePath });
    if (includeContent) qs.set("includeContent", "true");
    return fetchJson(apiPath("/api", `/codebase/file?${qs.toString()}`), { headers: headers() });
  },
  fileConnections: (filePath, branch = "main") =>
    fetchJson(
      apiPath(
        "/api",
        `/codebase/file/connections?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(filePath)}`
      ),
      { headers: headers() }
    ),
  tour: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/tour?branch=${encodeURIComponent(branch)}`), {
      headers: headers(),
    }),
  generateTour: (branch = "main") =>
    fetchJson(apiPath("/api/codebase/tour/generate"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ branchName: branch }),
    }),
  health: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/health?branch=${encodeURIComponent(branch)}`), {
      headers: headers(),
    }),
  healthTimeline: (branch = "main", days = 30) =>
    fetchJson(
      apiPath(
        "/api",
        `/codebase/health/timeline?branch=${encodeURIComponent(branch)}&days=${days}`
      ),
      { headers: headers() }
    ),
  impact: (payload) =>
    fetchJson(apiPath("/api/codebase/impact"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  knowledge: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/knowledge?branch=${encodeURIComponent(branch)}`), {
      headers: headers(),
    }),
  generateKnowledge: (branch = "main") =>
    fetchJson(apiPath("/api/codebase/knowledge/generate"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ branchName: branch }),
    }),
  gnGraph: (branch = "main", { collapse = true, limit } = {}) => {
    const qs = new URLSearchParams({ branch });
    if (!collapse) qs.set("collapse", "false");
    if (limit) qs.set("limit", String(limit));
    return fetchJson(apiPath("/api", `/codebase/gn/graph?${qs}`), { headers: headers() });
  },
  gnAnalyze: (branch = "main") =>
    fetchJson(apiPath("/api/codebase/gn/analyze"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ branchName: branch }),
    }),
  gnQuery: (payload) =>
    fetchJson(apiPath("/api/codebase/gn/query"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  gnContext: (payload) =>
    fetchJson(apiPath("/api/codebase/gn/context"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  gnImpact: (payload) =>
    fetchJson(apiPath("/api/codebase/gn/impact"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  gnDetectChanges: (payload) =>
    fetchJson(apiPath("/api/codebase/gn/detect_changes"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }),
  gnWiki: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/gn/wiki?branch=${encodeURIComponent(branch)}`), {
      headers: headers(),
    }),
  gnStatus: (branch = "main") =>
    fetchJson(apiPath("/api", `/codebase/gn/status?branch=${encodeURIComponent(branch)}`), {
      headers: headers(),
    }),
  gnResources: (resource, { branch, name } = {}) => {
    const qs = new URLSearchParams();
    if (branch) qs.set("branch", branch);
    if (name) qs.set("name", name);
    const suffix = qs.toString() ? `?${qs}` : "";
    return fetchJson(apiPath("/api", `/codebase/gn/resources/${encodeURIComponent(resource)}${suffix}`), {
      headers: headers(),
    });
  },
};

const mockCodebaseAdapter = {
  status: () => mockApi.codebaseLayerStatus(),
  insights: (branch) => mockApi.codebaseInsights(branch),
  triggerFullIndex: (branch) => mockApi.triggerFullCodebaseIndex(branch),
  structure: () => mockApi.codebaseStructure(),
  branches: () => mockApi.codebaseBranches(),
  commits: () => mockApi.codebaseCommits(),
  search: (query, branch) => mockApi.codebaseSearch(query, branch),
  visualization: (branch, refresh) => mockApi.codebaseVisualization(branch, refresh),
  fileInterior: (branch, filePath) => mockApi.codebaseFileInterior(branch, filePath),
  ask: (question, branch) => mockApi.codebaseAsk(question, branch),
  directory: (dirPath, branch) => mockApi.codebaseDirectory(dirPath, branch),
  file: (filePath) => mockApi.codebaseFileIntelligence(filePath),
  fileConnections: (filePath, branch) => mockApi.codebaseFileConnections(filePath, branch),
  tour: (branch) => mockApi.codebaseTour(branch),
  generateTour: (branch) => mockApi.generateCodebaseTour(branch),
  health: (branch) => mockApi.codebaseHealth(branch),
  healthTimeline: (branch, days) => mockApi.codebaseHealthTimeline(branch, days),
  knowledge: (payload) => mockApi.codebaseImpact(payload),
  knowledge: (branch) => mockApi.codebaseKnowledge(branch),
  generateKnowledge: (branch) => mockApi.generateCodebaseKnowledge(branch),
  gnGraph: async () => ({
    view: "clusters",
    nodes: [
      { id: "c1", label: "auth", kind: "Cluster", size: 20, memberCount: 12 },
      { id: "c2", label: "api", kind: "Cluster", size: 16, memberCount: 8 },
    ],
    edges: [{ id: "e1", source: "c1", target: "c2", type: "CLUSTER_LINK" }],
    meta: { symbolCount: 20, edgeCount: 30, clusterCount: 2, processCount: 1 },
    source: "mock",
  }),
  gnAnalyze: async () => ({ ok: true, meta: { symbolCount: 20 } }),
  gnQuery: async () => ({ processes: [], process_symbols: [], definitions: [] }),
  gnContext: async () => ({ error: "symbol_not_found" }),
  gnImpact: async () => ({ depths: {} }),
  gnDetectChanges: async () => ({
    summary: { changed_count: 0, affected_count: 0, changed_files: 0, risk_level: "low" },
  }),
  gnWiki: async () => ({
    overview: "Mock knowledge graph wiki",
    pages: [],
    source: "heuristic",
    generatedAt: new Date().toISOString(),
  }),
  gnStatus: async () => ({ ready: true, symbolCount: 20 }),
  gnResources: async (resource) => {
    if (resource === "processes") {
      return { processes: [{ id: "p1", name: "login flow", type: "intra_community", steps: 3 }] };
    }
    return {};
  },
};

export const codebaseAdapter =
  DATA_MODE === "rest" ? restCodebaseAdapter : mockCodebaseAdapter;

export function fetchCodebaseLayerStatus(branch) {
  return codebaseAdapter.status(branch);
}

export function triggerFullCodebaseIndex(branch) {
  return codebaseAdapter.triggerFullIndex(branch);
}

export function useCodebaseLayerStatus(options = {}) {
  const branch = options.branch;
  return useResource(() => fetchCodebaseLayerStatus(branch), [branch], {
    pollMs: options.pollMs ?? 12000,
  });
}

export function fetchCodebaseInsights(branch) {
  return codebaseAdapter.insights(branch);
}

export function useCodebaseInsights(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => fetchCodebaseInsights(branch), [branch], {
    pollMs: options.pollMs ?? 60_000,
  });
}

export function useCodebaseStructure(options = {}) {
  return useResource(() => codebaseAdapter.structure(), [], { pollMs: options.pollMs });
}

export function useCodebaseBranches(options = {}) {
  return useResource(() => codebaseAdapter.branches(), [], { pollMs: options.pollMs });
}

export function useCodebaseCommits(options = {}) {
  return useResource(() => codebaseAdapter.commits(), [], { pollMs: options.pollMs });
}

export function useCodebaseSearch(query, options = {}) {
  const branch = options.branch ?? "main";
  return useResource(
    () =>
      query?.trim()
        ? codebaseAdapter.search(query, branch)
        : Promise.resolve({ query: "", files: [], patterns: [], results: [] }),
    [query, branch],
    { pollMs: options.pollMs }
  );
}

export function useCodebaseVisualization(options = {}) {
  const branch = options.branch ?? "main";
  const refresh = Boolean(options.refresh);
  return useResource(() => codebaseAdapter.visualization(branch, refresh), [branch, refresh], {
    pollMs: options.pollMs ?? 120_000,
  });
}

export function useCodebaseFileInterior(filePath, branch = "main") {
  return useResource(
    () =>
      filePath
        ? codebaseAdapter.fileInterior(branch, filePath)
        : Promise.resolve({ blocks: [] }),
    [filePath, branch],
    { pollMs: 0 }
  );
}

export async function askCodebase(question, branch = "main") {
  return codebaseAdapter.ask(question, branch);
}

export function fetchCodebaseDirectory(dirPath, branch = "main") {
  return codebaseAdapter.directory(dirPath, branch);
}

export function useCodebaseDirectory(dirPath = "", branch = "main") {
  return useResource(
    () => fetchCodebaseDirectory(dirPath, branch),
    [dirPath, branch],
    { pollMs: 0 }
  );
}

export function fetchCodebaseFile(filePath, branch = "main", includeContent = false) {
  if (!filePath) return Promise.resolve({ file: null });
  return codebaseAdapter.file(filePath, branch, includeContent);
}

export function useCodebaseFile(filePath, branch = "main", options = {}) {
  const includeContent = Boolean(options.includeContent);
  return useResource(
    () => fetchCodebaseFile(filePath, branch, includeContent),
    [filePath, branch, includeContent],
    { pollMs: 0 }
  );
}

export function fetchCodebaseFileConnections(filePath, branch = "main") {
  if (!filePath) return Promise.resolve({ outgoing: [], incoming: [] });
  return codebaseAdapter.fileConnections(filePath, branch);
}

export function useCodebaseFileConnections(filePath, branch = "main") {
  return useResource(
    () => fetchCodebaseFileConnections(filePath, branch),
    [filePath, branch],
    { pollMs: 0 }
  );
}

export function fetchCodebaseTour(branch = "main") {
  return codebaseAdapter.tour(branch);
}

export async function generateCodebaseTour(branch = "main") {
  return codebaseAdapter.generateTour(branch);
}

export function useCodebaseTour(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => fetchCodebaseTour(branch), [branch], {
    pollMs: options.pollMs ?? 120_000,
  });
}

export function fetchCodebaseHealth(branch = "main") {
  return codebaseAdapter.health(branch);
}

export function useCodebaseHealth(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => fetchCodebaseHealth(branch), [branch], {
    pollMs: options.pollMs ?? 60_000,
  });
}

export function fetchCodebaseHealthTimeline(branch = "main", days = 30) {
  return codebaseAdapter.healthTimeline(branch, days);
}

export function useCodebaseHealthTimeline(options = {}) {
  const branch = options.branch ?? "main";
  const days = options.days ?? 30;
  return useResource(() => fetchCodebaseHealthTimeline(branch, days), [branch, days], {
    pollMs: options.pollMs ?? 120_000,
  });
}

export async function analyzeCodebaseImpact(payload) {
  return codebaseAdapter.impact(payload);
}

export function fetchCodebaseKnowledge(branch = "main") {
  return codebaseAdapter.knowledge(branch);
}

export function useCodebaseKnowledge(options = {}) {
  const branch = options.branch ?? "main";
  return useResource(() => fetchCodebaseKnowledge(branch), [branch], {
    pollMs: options.pollMs ?? 120_000,
  });
}

export async function generateCodebaseKnowledge(branch = "main") {
  return codebaseAdapter.generateKnowledge(branch);
}

export function fetchGitNexusGraph(branch = "main", options = {}) {
  return codebaseAdapter.gnGraph(branch, options);
}

export async function analyzeGitNexusGraph(branch = "main") {
  return codebaseAdapter.gnAnalyze(branch);
}

export async function gitNexusQuery(payload) {
  return codebaseAdapter.gnQuery(payload);
}

export async function gitNexusImpact(payload) {
  return codebaseAdapter.gnImpact(payload);
}

export async function gitNexusDetectChanges(payload) {
  return codebaseAdapter.gnDetectChanges(payload);
}

export function fetchGitNexusWiki(branch = "main") {
  return codebaseAdapter.gnWiki(branch);
}

export function fetchGitNexusStatus(branch = "main") {
  return codebaseAdapter.gnStatus(branch);
}

export function gitNexusContext(payload) {
  return codebaseAdapter.gnContext(payload);
}

export function fetchGitNexusResources(resource, options = {}) {
  return codebaseAdapter.gnResources(resource, options);
}
