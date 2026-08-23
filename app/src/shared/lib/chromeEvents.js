export const FOCUS_DASHBOARD_COMPOSER = "agentox-focus-composer";

export function focusDashboardComposer() {
  window.dispatchEvent(new CustomEvent(FOCUS_DASHBOARD_COMPOSER));
}
