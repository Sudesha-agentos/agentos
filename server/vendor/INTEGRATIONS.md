# OSS integrations — fix runtime, do not migrate full repos

**Do not copy entire Semgrep / Cover-Agent / Locust / ZAP / Hypothesis / Playwright monorepos into this tree.**
AgentOX shells out to **installed CLIs** (plus small vendored slices below). If tools show as skipped/failed, the host is missing binaries — not missing source.

## Render host checklist

1. Redeploy API with [`render.yaml`](../render.yaml) — build runs `bash scripts/install-oss-tools.sh`.
2. Use **≥1GB RAM** (2GB+ recommended). 512MB cannot run Playwright + Semgrep reliably.
3. Set `OSS_TOOLS_REQUIRED=1` in production (already in blueprint) so missing CLIs become **failed** artifacts, not quiet skips.
4. Confirm `GET /api/integrations/oss-status` (auth) or `/healthz` → `ossTools.ready`.
5. Vercel needs only a frontend redeploy for the ToolArtifactsPanel host banner — no new Vercel env for these CLIs.
6. ZAP: prefer Docker (`ghcr.io/zaproxy/zaproxy:stable`) or accept failed ZAP on Node-only Render.

Install manually if the build script cannot:

```bash
pip install semgrep cover-agent pytest hypothesis locust
cd vendor/playwright-monitor && npm install && npx playwright install chromium
```

## Per-ticket orchestration

| Phase | When | Tools (always attempted) | Frontend |
|-------|------|--------------------------|----------|
| 1 Engineering | After Ananta coding | Tree-sitter symbols, Aider capability, mini-SWE/ACI note | Ananta `ToolArtifactsPanel` lane=`engineering` |
| 2 QA | After Neel agent loop | Semgrep, Playwright smoke **or** monitor, Cover-Agent, Hypothesis | Neel overview lane=`qa` |
| 3 Canary | After exploration | Playwright monitor → ZAP → Locust | Canary tab + live pipeline |

Kill switches: `QA_OSS_ADAPTERS=0`, `CANARY_OSS_ADAPTERS=0`, `OSS_TOOLS_REQUIRED=0` (soft-skip missing CLIs).

## Vendored (small slices only)

| Path | What |
|------|------|
| `aider/` | Editblock algorithm → `integrations/aider/editblock.ts` |
| `mini-swe-agent/` | ACI prompts |
| `gitnexus*` | Knowledge graph |
| `locust/locustfile.py` | Default Locust user |
| `playwright-monitor/` | Synthetic monitor scaffold |

## Persistence

`ToolArtifact` rows: memory + `data/tool-artifacts/` (`TOOL_ARTIFACTS_DATA_DIR`). Use a Render persistent disk if you need survival across deploys.
