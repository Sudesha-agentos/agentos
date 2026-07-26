import { BaseLogAdapter } from "./baseAdapter";
import type { NormalizedLogEntry } from "../ingestion/schema";

/** Placeholder for Phase 2 adapters. */
export class StubLogAdapter extends BaseLogAdapter {
  constructor(public readonly sourceType: string) {
    super();
  }

  async pull(): Promise<NormalizedLogEntry[]> {
    throw new Error(`${this.sourceType}_adapter_not_implemented`);
  }

  async stream(): Promise<() => void> {
    throw new Error(`${this.sourceType}_adapter_not_implemented`);
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    return {
      valid: false,
      error: `${this.sourceType} adapter is not implemented yet (Phase 2)`,
    };
  }
}
