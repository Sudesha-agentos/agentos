/** First-login product tour "seen" flag — same pattern as agentos-viz-tour-seen. */

const KEY_PREFIX = "agentos.product-tour-seen.";

function keyFor(userId) {
  return `${KEY_PREFIX}${userId || "anon"}`;
}

export function hasSeenProductTour(userId) {
  try {
    return localStorage.getItem(keyFor(userId)) === "1";
  } catch {
    return true;
  }
}

export function markProductTourSeen(userId) {
  try {
    localStorage.setItem(keyFor(userId), "1");
  } catch {
    // Storage unavailable — tour will re-offer next session, which is fine.
  }
}

export function clearProductTourSeen(userId) {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}

/** Window event the TopBar replay button uses to restart the tour. */
export const PRODUCT_TOUR_START_EVENT = "agentos:start-product-tour";

// Wizard → tour hand-off. Router navigation state gets dropped by the org
// slug-normalization redirects that run while the app boots, so the wizard
// records the hand-off in sessionStorage instead (cleared once consumed).
const PENDING_KEY = "agentos.product-tour.pending";

export function setProductTourPending() {
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumeProductTourPending() {
  try {
    const pending = sessionStorage.getItem(PENDING_KEY) === "1";
    if (pending) sessionStorage.removeItem(PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}
