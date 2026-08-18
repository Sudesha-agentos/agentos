import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";

export async function searchBoard(keyword, searchIn = "both") {
  const params = new URLSearchParams({ keyword, searchIn });
  return fetchJson(apiPath("/jira-intake", `/boards/search?${params}`), {
    headers: authHeaders(),
  });
}

export async function getIntakeHealth() {
  return fetchJson(apiPath("/jira-intake", "/health"), { headers: authHeaders() });
}
