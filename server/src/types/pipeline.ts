export type VectorContentType =
  | "ticket"
  | "prd"
  | "qa_report"
  | "implementation"
  | "canary_finding"
  | "org_intelligence"
  | "company_intelligence";

export interface RetrievedContext {
  jiraTicketId: string;
  jiraKey: string;
  contentType: VectorContentType;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface CompressedContext {
  text: string;
  tokenEstimate: number;
  chunksUsed: number;
  droppedChunks: number;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  path?: string;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  amberFlags: string[];
  checkedAt: string;
}

export type GateId =
  | "virin_discovery"
  | "virin_prd"
  | "prd"
  | "implementation"
  | "qa";

export interface GateFinding {
  code: string;
  message: string;
  severity: "error" | "warning";
  path?: string;
  symbol?: string;
  requirement?: string;
}

export interface GateResult extends ValidationResult {
  gateId: GateId;
  evidenceRefs: string[];
  blockingIssueCodes: string[];
  findings?: GateFinding[];
}

export interface PipelineRunJob {
  ticketId: string;
}

export interface CodebaseIndexJob {
  branchName: string;
  changedFiles: string[];
  deletedFiles: string[];
  commitSha: string;
  triggerType: "webhook" | "manual";
}

export interface JiraMirrorBackfillJob {
  projectKeys?: string[];
  maxIssues?: number;
}

export interface CodebaseFullIndexJob {
  branchName: string;
  runId: string;
  triggerType: "webhook" | "manual";
}
