# Ananta → Neel handoff

Neel is **not** started by a separate Virin-style handoff API. After Ananta writes code, the same pipeline advances:

1. `ENGINEERING_AGENT` (plan + coding)
2. `IMPLEMENTATION_VALIDATION` (gate)
3. If gate **passes** → `QA_AGENT` (Neel) automatically
4. If gate **fails** → pipeline `PAUSED` — human must resume/override before Neel runs

## Verify a stuck ticket

For the Jira key that “wrote code” but shows nothing in Neel:

1. Open **Pipelines** → that pipeline’s `currentStage` / `status`
2. `IMPLEMENTATION_VALIDATION` + `PAUSED` → Neel never started; use **Continue to Neel** on Ananta / Neel inbox, or pipeline Override/Resume
3. `QA_AGENT` + `RUNNING` → Neel is working; open `/qa?pipeline=<id>`
4. `FAILED` before `QA_AGENT` → check audit (`ENGINEERING_*`, validation errors)
5. Neel **completed reports** appear only after `QA_AGENT` stage status is `COMPLETED`

## Inbox API

`GET /api/qa/inbox` returns:

- `running` — pipelines on `QA_AGENT` / `QA_VALIDATION`
- `blocked` — `PAUSED` at `IMPLEMENTATION_VALIDATION`
- `completed` — finished QA stage summaries

## Validator note

Do **not** relax `LOW_CONFIDENCE` (&lt; 0.7) in `implementationValidator` unless production logs show frequent false pauses after successful code push. Prefer resume/override UX first.
