"use strict";

/**
 * App Runner injects the full Secrets Manager JSON as APP_SECRETS.
 * Expand keys into process.env, then start the API.
 */
function applySecrets() {
  const raw = process.env.APP_SECRETS;
  if (!raw) return;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("APP_SECRETS is not valid JSON — ignoring");
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
  for (const [key, value] of Object.entries(parsed)) {
    if (value == null) continue;
    const str = String(value);
    if (!str) continue;
    if (process.env[key]) continue;
    process.env[key] = str;
  }
  delete process.env.APP_SECRETS;
}

applySecrets();
require("../dist/server.js");
