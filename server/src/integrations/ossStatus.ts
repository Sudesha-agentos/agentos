/**
 * Probe which OSS CLIs are available on the host (Render / local).
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { isOssToolsRequired } from "./cliSoftSkip";

const execAsync = promisify(exec);

export type OssCliId =
  | "semgrep"
  | "cover-agent"
  | "pytest"
  | "hypothesis"
  | "locust"
  | "playwright"
  | "zap";

export type OssCliStatus = {
  id: OssCliId;
  label: string;
  installed: boolean;
  version?: string;
  installHint: string;
  requiredFor: Array<"qa" | "canary">;
};

async function probe(cmd: string): Promise<{ ok: boolean; version?: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 15_000,
      env: { ...process.env },
    });
    const text = `${stdout}\n${stderr}`.trim();
    const first = text.split(/\r?\n/).find((l) => l.trim()) ?? text;
    return { ok: true, version: first.slice(0, 120) };
  } catch {
    return { ok: false };
  }
}

export async function getOssToolStatus(): Promise<{
  required: boolean;
  ready: boolean;
  tools: OssCliStatus[];
  notes: string[];
}> {
  const [
    semgrep,
    cover,
    pytest,
    hyp,
    locust,
    playwright,
    zapLocal,
    zapDocker,
  ] = await Promise.all([
    probe("semgrep --version"),
    probe("cover-agent --help"),
    probe("python -m pytest --version"),
    probe("python -c \"import hypothesis; print(hypothesis.__version__)\""),
    probe("locust --version"),
    probe("npx playwright --version"),
    probe("zap-baseline.py -h"),
    probe("docker image inspect ghcr.io/zaproxy/zaproxy:stable"),
  ]);

  const tools: OssCliStatus[] = [
    {
      id: "semgrep",
      label: "Semgrep",
      installed: semgrep.ok,
      version: semgrep.version,
      installHint: "pip install semgrep",
      requiredFor: ["qa"],
    },
    {
      id: "cover-agent",
      label: "Cover-Agent",
      installed: cover.ok,
      version: cover.version,
      installHint: "pip install cover-agent",
      requiredFor: ["qa"],
    },
    {
      id: "pytest",
      label: "pytest",
      installed: pytest.ok,
      version: pytest.version,
      installHint: "pip install pytest",
      requiredFor: ["qa"],
    },
    {
      id: "hypothesis",
      label: "Hypothesis",
      installed: hyp.ok,
      version: hyp.version,
      installHint: "pip install hypothesis",
      requiredFor: ["qa"],
    },
    {
      id: "locust",
      label: "Locust",
      installed: locust.ok,
      version: locust.version,
      installHint: "pip install locust",
      requiredFor: ["canary"],
    },
    {
      id: "playwright",
      label: "Playwright",
      installed: playwright.ok,
      version: playwright.version,
      installHint: "npm i -D @playwright/test && npx playwright install chromium",
      requiredFor: ["qa", "canary"],
    },
    {
      id: "zap",
      label: "OWASP ZAP",
      installed: zapLocal.ok || zapDocker.ok,
      version: zapLocal.version || (zapDocker.ok ? "docker:zaproxy/stable" : undefined),
      installHint:
        "install zap-baseline.py or docker pull ghcr.io/zaproxy/zaproxy:stable",
      requiredFor: ["canary"],
    },
  ];

  const notes: string[] = [
    "Do not vendor full upstream monorepos — install CLIs on the host (see scripts/install-oss-tools.sh).",
    "Recommend Render plan ≥1GB RAM (2GB+ for Playwright + Semgrep).",
    "ZAP on native Node Render is best via Docker; otherwise expect failed/skipped ZAP.",
  ];

  const required = isOssToolsRequired();
  // Core readiness: Semgrep + Playwright for QA path; Locust optional for canary
  const coreIds: OssCliId[] = ["semgrep", "playwright"];
  const ready = coreIds.every((id) => tools.find((t) => t.id === id)?.installed);

  return { required, ready, tools, notes };
}
