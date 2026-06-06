# AgentOS Pipeline Demo — Horizon Commerce

End-to-end demo: **Jira Epic → AI Worker → decomposed subtask queue → PRD → code changes** against the Horizon Commerce codebase.

## What you get

| Asset | Path |
|-------|------|
| Jira import CSV (19 tickets, Epic→Story→Sub-task) | `scripts/pipeline-demo-jira-import.csv` |
| Regenerate CSV + mapping | `node scripts/generate-pipeline-demo.mjs` |
| Demo codebase | `demo/horizon-commerce-platform/` |
| Ticket ↔ file map | `demo/horizon-commerce-platform/demo/jira-mapping.json` |
| GitHub (public) | https://github.com/ZoroXRoronoa/horizon-commerce-platform |

## 1. Import Jira data

1. In Jira Cloud, create or use a **Scrum** project (e.g. `SCRUM`).
2. **Project settings → Import** → upload `scripts/pipeline-demo-jira-import.csv`.
3. Map columns if prompted. Ensure **Parent** links stories to epics and sub-tasks to stories.
4. After import, note your **Board ID** (Board settings → URL contains `board/1` → use `1`).

Imported keys will be `SCRUM-1`, `SCRUM-2`, … (Jira assigns keys; work item ids like `HC-EPIC-01` are labels in descriptions).

### Board setup

Add an **AI Worker** column (or map an existing status):

- Create status `AI Worker` if needed
- Add it to your board workflow
- Most demo tickets are **To Do** — ready to move into AI Worker

## 2. Configure AgentOS server

In `server/.env`:

```env
PIPELINE_JIRA_BASE_URL=https://your-domain.atlassian.net
PIPELINE_JIRA_EMAIL=you@company.com
PIPELINE_JIRA_API_TOKEN=...
PIPELINE_JIRA_PROJECT_KEYS=SCRUM
PIPELINE_JIRA_BOARD_ID=1
PIPELINE_JIRA_AI_WORKER_STATUSES=AI Worker
PUBLIC_API_URL=https://your-render-host.onrender.com

GITHUB_REPO_OWNER=ZoroXRoronoa
GITHUB_REPO_NAME=horizon-commerce-platform
# Or connect via GitHub App in the UI
```

## 3. Connect integrations (UI)

1. **Settings → Git Integration** — connect `horizon-commerce-platform`, run **Index codebase**.
2. **Settings → Jira** — connect pipeline Jira, pick **AI Worker** intake column, register webhook.
3. Optional: run **Mirror backfill** — picks up `HC-099` (Done) for RAG context.

## 4. Run the demo

### Option A — Epic intake (recommended)

Move **HC-EPIC-02** (Checkout & payments) to **AI Worker**.

Pipeline will:

1. Find stories HC-201, HC-202, HC-203
2. Expand each story to subtasks (e.g. HC-201-1, HC-201-2)
3. Queue subtasks **one at a time**, keeping each story's subtasks together

Expected queue for Epic 02:

```
HC-201-1 → HC-201-2 → HC-202-1 → HC-203-1
```

### Option B — Single story

Move **HC-201** (Fix duplicate charge) to AI Worker → queues HC-201-1 then HC-201-2.

### Option C — Leaf subtask

Move **HC-201-1** directly → runs one pipeline for that subtask only.

## 5. Verify pipeline output

- **Dashboard** — watch pipeline stages (Discovery → PRD → Engineering → QA)
- **Codebase** — agent should target files listed in subtask descriptions
- **Jira** — PRD/implementation comments attached to ticket

Known demo bugs the agent should fix:

- `checkoutService.ts` — restore idempotency (HC-201-1)
- `webhookDispatcher.ts` — full-body HMAC (HC-202-1)

Run tests before/after in the demo repo:

```bash
cd demo/horizon-commerce-platform
node --test test/checkout.test.js   # fails until HC-201-1 is fixed
```

## Regenerate demo data

```bash
node scripts/generate-pipeline-demo.mjs
```

Updates CSV and `demo/jira-mapping.json`. Re-import CSV into Jira if you change ticket structure.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Tickets not on board | Add to sprint or move from backlog to board |
| Webhook not firing | Check `PUBLIC_API_URL`, webhook secret, ngrok for local |
| Epic queues nothing | Ensure stories linked via Parent or Epic Link in Jira |
| Subtasks not found | Confirm sub-task issue type exists in project |
| RAG empty | Run codebase index + mirror backfill |
