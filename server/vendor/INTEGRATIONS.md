# OSS integrations — Phases 1–3 (mandatory per ticket)

**We do not re-ship full upstream monorepos.** AgentOX runs **installed CLIs** (or in-process ports)
automatically at the end of each lane, and always writes a `ToolArtifact` so the frontend checklist fills in.

## Per-ticket orchestration

| Phase | When | Tools (always attempted) | Frontend |
|-------|------|--------------------------|----------|
| 1 Engineering | After Ananta coding | Tree-sitter symbols, Aider capability, mini-SWE/ACI note | Ananta `ToolArtifactsPanel` lane=`engineering` |
| 2 QA | After Neel agent loop | Semgrep, Playwright smoke **or** monitor, Cover-Agent, Hypothesis | Neel overview lane=`qa` |
| 3 Canary | After exploration | Playwright monitor → ZAP → Locust | Canary tab + live pipeline |

Disable all mandatory suites only with `QA_OSS_ADAPTERS=0` / `CANARY_OSS_ADAPTERS=0` (not recommended).

## Vendored

| Path | What |
|------|------|
| `aider/` | Editblock algorithm → `integrations/aider/editblock.ts` |
| `mini-swe-agent/` | ACI prompts |
| `gitnexus*` | Knowledge graph |
| `locust/locustfile.py` | Default Locust user |
| `playwright-monitor/` | Synthetic monitor (created/ensured at runtime) |

## Install CLIs on the host

```bash
pip install cover-agent pytest hypothesis locust semgrep
# Playwright: npm i -D @playwright/test && npx playwright install chromium
# ZAP: zap-baseline.py or docker pull ghcr.io/zaproxy/zaproxy:stable
```

Artifacts persist under `data/tool-artifacts/` (`TOOL_ARTIFACTS_DATA_DIR`).
