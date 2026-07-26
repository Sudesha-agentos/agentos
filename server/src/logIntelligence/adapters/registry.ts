import type { BaseLogAdapter } from "./baseAdapter";
import { RenderAdapter } from "./renderAdapter";
import { SentryAdapter } from "./sentryAdapter";
import { RailwayAdapter } from "./railwayAdapter";
import { CloudWatchAdapter } from "./cloudwatchAdapter";
import { DatadogAdapter } from "./datadogAdapter";
import { LokiAdapter } from "./lokiAdapter";
import { OtlpAdapter } from "./otlpAdapter";

const adapters: Record<string, () => BaseLogAdapter> = {
  render: () => new RenderAdapter(),
  sentry: () => new SentryAdapter(),
  railway: () => new RailwayAdapter(),
  cloudwatch: () => new CloudWatchAdapter(),
  datadog: () => new DatadogAdapter(),
  grafana_loki: () => new LokiAdapter(),
  loki: () => new LokiAdapter(),
  otlp: () => new OtlpAdapter(),
  custom: () => new OtlpAdapter(),
};

export function getAdapter(sourceType: string): BaseLogAdapter {
  const factory = adapters[sourceType];
  if (!factory) {
    throw new Error(`unknown_log_source_type:${sourceType}`);
  }
  return factory();
}

export function listSupportedSourceTypes(): string[] {
  return Object.keys(adapters);
}
