import { apiPath } from "../config/apiBase";
import { DATA_MODE, DATA_MODES } from "../config/app";

const POLL_MS = 1500;
const ATTEMPT_TIMEOUT_MS = 8000;

let ready = shouldSkipWait();
let inFlight = null;

function shouldSkipWait() {
  if (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test") {
    return true;
  }
  return DATA_MODE !== DATA_MODES.REST;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function pingHealthz() {
  const res = await fetch(apiPath("/api", "/healthz"), {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
  });
  if (!res.ok) return false;
  const body = await res.json().catch(() => null);
  return body?.status === "ok" || body?.status === "ready";
}

async function pollUntilReady() {
  for (;;) {
    try {
      if (await pingHealthz()) return;
    } catch {
      /* Render 502 / connection refused while the dyno is waking */
    }
    await sleep(POLL_MS);
  }
}

/** True once the API has answered /healthz (or wait is skipped). */
export function isBackendReady() {
  return ready;
}

/**
 * Resolves when the API process is up. One shared poll so the first page
 * load also wakes a sleeping Render dyno.
 */
export function waitForBackend() {
  if (ready) return Promise.resolve();
  if (shouldSkipWait()) {
    ready = true;
    return Promise.resolve();
  }
  if (!inFlight) {
    inFlight = pollUntilReady().then(() => {
      ready = true;
    });
  }
  return inFlight;
}
