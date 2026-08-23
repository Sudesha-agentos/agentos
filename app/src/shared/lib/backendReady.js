import { apiPath } from "../config/apiBase";
import { DATA_MODE, DATA_MODES } from "../config/app";

const POLL_MS = 1500;
/** Render cold start can exceed 8s; aborting early looks like a permanent hang. */
const ATTEMPT_TIMEOUT_MS = 30000;

const listeners = new Set();

let ready = shouldSkipWait();
let inFlight = null;

function shouldSkipWait() {
  if (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test") {
    return true;
  }
  return DATA_MODE !== DATA_MODES.REST;
}

function notifyReady(value) {
  ready = value;
  listeners.forEach((fn) => {
    fn(value);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function healthzUrl() {
  return apiPath("/api", "/healthz");
}

export function subscribeBackendReady(fn) {
  listeners.add(fn);
  fn(ready);
  return () => listeners.delete(fn);
}

async function pingHealthz() {
  const res = await fetch(healthzUrl(), {
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
 * Resolves when the API process is up. One shared poll so marketing traffic
 * can wake a sleeping Render dyno without blocking the page.
 */
export function waitForBackend() {
  if (ready) return Promise.resolve();
  if (shouldSkipWait()) {
    notifyReady(true);
    return Promise.resolve();
  }
  if (!inFlight) {
    inFlight = pollUntilReady().then(() => {
      notifyReady(true);
    });
  }
  return inFlight;
}

/** Start a new poll (e.g. Retry on the splash). Safe if one is already running. */
export function retryWaitForBackend() {
  if (shouldSkipWait()) {
    notifyReady(true);
    return Promise.resolve();
  }
  notifyReady(false);
  inFlight = pollUntilReady().then(() => {
    notifyReady(true);
  });
  return inFlight;
}
