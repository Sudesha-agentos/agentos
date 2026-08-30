export type SimAgent = "system" | "virin" | "ananta" | "neel";

export type SimEventKind = "stage" | "log" | "tool" | "artifact" | "error" | "done";

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
};

export type SimRun = {
  id: string;
  organizationId: string;
  requirement: string;
  status: SimRunStatus;
  startedAt: number;
  finishedAt?: number;
  events: SimEvent[];
  result?: SimRunResult;
  error?: string;
};
