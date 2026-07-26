/**
 * Base class for all log source adapters.
 */

import { createHash, randomUUID } from "node:crypto";
import type {
  LogSeverityLevel,
  NormalizedLogEntry,
} from "../ingestion/schema";

export abstract class BaseLogAdapter {
  abstract sourceType: string;

  abstract pull(input: {
    config: Record<string, unknown>;
    since: Date;
    until: Date;
    environment?: string;
    severityFilter?: LogSeverityLevel[];
    limit?: number;
    sourceId?: string;
  }): Promise<NormalizedLogEntry[]>;

  abstract stream(input: {
    config: Record<string, unknown>;
    sourceId?: string;
    onEntry: (entry: NormalizedLogEntry) => Promise<void>;
    onError: (error: Error) => void;
  }): Promise<() => void>;

  abstract validate(
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }>;

  protected newEntryId(): string {
    return randomUUID();
  }

  protected normaliseTimestamp(raw: string | number | Date): Date {
    if (raw instanceof Date) return raw;
    if (typeof raw === "number") {
      return raw > 1e12 ? new Date(raw) : new Date(raw * 1000);
    }
    return new Date(raw);
  }

  protected normaliseSeverity(raw: string): LogSeverityLevel {
    const lower = String(raw ?? "").toLowerCase();
    const map: Record<string, LogSeverityLevel> = {
      debug: "debug",
      trace: "debug",
      verbose: "debug",
      info: "info",
      information: "info",
      notice: "info",
      warn: "warn",
      warning: "warn",
      error: "error",
      err: "error",
      severe: "error",
      fatal: "fatal",
      critical: "fatal",
      emergency: "fatal",
      crit: "fatal",
      emerg: "fatal",
      alert: "fatal",
    };
    return map[lower] ?? "info";
  }

  protected extractErrorType(message: string): string | null {
    const patterns = [
      /^(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError):/,
      /duplicate key value violates unique constraint/,
      /foreign key constraint/,
      /connection refused|ECONNREFUSED/i,
      /connection timeout|ETIMEDOUT/i,
      /^(4\d\d|5\d\d)\s/,
      /^java\.\w+\.\w+Exception/,
      /^(ValueError|KeyError|AttributeError|ImportError|RuntimeError):/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return this.classifyMatch(match[0]);
    }
    return null;
  }

  private classifyMatch(matched: string): string {
    if (matched.includes("duplicate key")) return "UniqueConstraintViolation";
    if (matched.includes("foreign key")) return "ForeignKeyViolation";
    if (/ECONNREFUSED|connection refused/i.test(matched)) return "ConnectionRefused";
    if (/ETIMEDOUT|timeout/i.test(matched)) return "ConnectionTimeout";
    return matched.replace(/[:\s].*$/, "").trim();
  }

  protected generateStackHash(stackTrace: string | null): string | null {
    if (!stackTrace) return null;
    const normalised = stackTrace
      .replace(/:\d+:\d+/g, ":LINE:COL")
      .replace(/0x[0-9a-fA-F]+/g, "0xADDR")
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "UUID"
      )
      .replace(/\d{6,}/g, "ID")
      .trim();
    return createHash("sha256").update(normalised).digest("hex");
  }

  protected extractStackTrace(message: string): string | null {
    if (!/at\s+\S+|^\s+at\s+/m.test(message)) return null;
    const idx = message.search(/\n\s*at\s+/);
    if (idx < 0) return message.includes("\n") ? message : null;
    return message.slice(idx).trim().slice(0, 8000);
  }
}
