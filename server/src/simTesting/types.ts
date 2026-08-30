export type SimAgent = "system" | "virin" | "ananta" | "neel";

export type SimEventKind = "stage" | "log" | "tool" | "artifact" | "usage" | "prompt" | "error" | "done";

export type SimPromptKind = "question" | "approval";
export type SimPromptStatus = "open" | "answered" | "approved" | "dismissed";

export type SimPrompt = {
  id: string;
  agent: SimAgent;
  kind: SimPromptKind;
  title: string;
  body: string;
  status: SimPromptStatus;
  answer?: string;
  createdAt: number;
};

export type SimUsageLine = {
  agent: SimAgent;
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export type SimUsageTotals = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  lines: SimUsageLine[];
};

export type SimRunStatus = "queued" | "running" | "failed" | "completed";

export type SimEvent = {
  id: string;
  t: number;
  elapsedMs: number;
  agent: SimAgent;
  kind: SimEventKind;
  label: string;
  detail?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
};

export type SimRunResult = {
  jiraKey: string;
  branch: string;
  commitSha?: string;
  qaHandoffStatus?: number;
  prdTitle?: string;
  codingSummary?: string;
  filesChanged?: string[];
  qaTestCases?: number;
  qaToolCalls?: number;
  qaSummary?: string;
  whatWasDone?: string[];
  usage?: SimUsageTotals;
};

export type SimRun = {
  id: string;
  organizationId: string;
  requirement: string;
  status: SimRunStatus;
  startedAt: number;
  finishedAt?: number;
  events: SimEvent[];
  prompts: SimPrompt[];
  usage: SimUsageTotals;
  result?: SimRunResult;
  error?: string;
};
