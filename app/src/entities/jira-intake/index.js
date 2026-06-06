import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";

export async function searchBoard(keyword, searchIn = "both") {
  const params = new URLSearchParams({ keyword, searchIn });
  return fetchJson(apiPath("/jira-intake", `/boards/search?${params}`));
}

export async function getIntakeHealth() {
  return fetchJson(apiPath("/jira-intake", "/health"));
}
