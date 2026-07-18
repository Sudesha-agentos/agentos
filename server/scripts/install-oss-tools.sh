#!/usr/bin/env bash
# Install host CLIs for AgentOX OSS adapters (Semgrep, Cover-Agent, Hypothesis, Locust, Playwright).
# Used by Render buildCommand. Soft-fails steps so Node build still succeeds if a tool is unavailable.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[oss-tools] installing Python CLIs (semgrep, cover-agent, pytest, hypothesis, locust)…"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "[oss-tools] WARN: no python found — attempting apt-get (may fail on Node-only images)"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y python3 python3-pip python3-venv || true
  fi
  if command -v python3 >/dev/null 2>&1; then
    PY=python3
  else
    echo "[oss-tools] ERROR: Python not available; Semgrep/Cover-Agent/Locust/Hypothesis will fail until installed"
    PY=""
  fi
fi

if [[ -n "${PY}" ]]; then
  "${PY}" -m pip install --upgrade pip || true
  "${PY}" -m pip install --user semgrep cover-agent pytest hypothesis locust || \
    "${PY}" -m pip install semgrep cover-agent pytest hypothesis locust || true
  # Ensure user bin is on PATH for subsequent runtime
  if [[ -d "${HOME}/.local/bin" ]]; then
    echo "export PATH=\"${HOME}/.local/bin:\$PATH\"" >> "${HOME}/.profile" || true
  fi
fi

echo "[oss-tools] installing Playwright monitor deps + Chromium…"
MON_DIR="${ROOT}/vendor/playwright-monitor"
mkdir -p "${MON_DIR}"
if [[ ! -f "${MON_DIR}/package.json" ]]; then
  cat > "${MON_DIR}/package.json" <<'EOF'
{
  "name": "agentox-playwright-monitor",
  "private": true,
  "type": "module",
  "scripts": { "test": "playwright test" },
  "devDependencies": { "@playwright/test": "^1.49.0" }
}
EOF
fi
(
  cd "${MON_DIR}"
  npm install --no-fund --no-audit || true
  npx playwright install chromium || true
  # install-deps needs root (apt-get). Render's native runtime has no root but
  # already ships Chromium's shared libs, so only attempt this when we are root.
  if [[ "$(id -u)" -eq 0 ]]; then
    npx playwright install-deps chromium || true
  else
    echo "[oss-tools] skipping 'playwright install-deps' (no root); Render base image already has the required libs"
  fi
)

echo "[oss-tools] done. ZAP is not installed here — use Docker (ghcr.io/zaproxy/zaproxy:stable) or accept failed/skipped ZAP artifacts."
echo "[oss-tools] Recommend Render instance ≥1GB RAM (2GB+ for Playwright + Semgrep)."
