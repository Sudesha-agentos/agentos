export const FOCUS_DASHBOARD_COMPOSER = "agentox-focus-composer";
export const OPEN_CREATE_NEW = "agentox-open-create-new";

export function focusDashboardComposer() {
  window.dispatchEvent(new CustomEvent(FOCUS_DASHBOARD_COMPOSER));
}

export function openCreateNew() {
  window.dispatchEvent(new CustomEvent(OPEN_CREATE_NEW));
}
