/** Common log schema — every adapter must produce this shape. */

export type LogSeverityLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogEnvironment =
  | "production"
  | "staging"
  | "preview"
  | "development";

export interface NormalizedLogEntry {
  id: string;
  sourceId: string;
  sourceType: string;

  timestamp: Date;
  severity: LogSeverityLevel;
  message: string;

  errorType: string | null;
  errorCode: string | null;
  stackTrace: string | null;
  stackTraceHash: string | null;

  httpMethod: string | null;
  httpStatus: number | null;
  endpoint: string | null;
  requestId: string | null;
  userId: string | null;

  serviceName: string;
  serviceVersion: string | null;
  deploymentId: string | null;
  environment: LogEnvironment;
  region: string | null;
  instanceId: string | null;

  rawPayload: Record<string, unknown>;
}

export interface ErrorFingerprint {
  hash: string;
  errorType: string;
  messageTemplate: string;
  stackTemplate: string | null;
}
