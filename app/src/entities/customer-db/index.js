import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";

const root = (path = "") => apiPath("/api", `/customer-db${path}`);

function requestHeaders(extra = {}) {
  return { ...authHeaders(), ...extra };
}

export async function listCustomerDatabases() {
  return fetchJson(root(), { headers: requestHeaders() });
}

export async function getCustomerDatabase(id) {
  return fetchJson(root(`/${id}`), { headers: requestHeaders() });
}

export async function createCustomerDatabase(body) {
  return fetchJson(root(), {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });
}

export async function updateCustomerDatabase(id, body) {
  return fetchJson(root(`/${id}`), {
    method: "PATCH",
    headers: requestHeaders(),
    body: JSON.stringify(body),
  });
}

export async function deleteCustomerDatabase(id) {
  return fetchJson(root(`/${id}`), {
    method: "DELETE",
    headers: requestHeaders(),
  });
}

export async function testCustomerDatabase(id) {
  return fetchJson(root(`/${id}/test`), {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({}),
  });
}

export async function introspectCustomerDatabase(id) {
  return fetchJson(root(`/${id}/introspect`), {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({}),
  });
}

export async function listCustomerDatabaseMigrations(id) {
  return fetchJson(root(`/${id}/migrations`), { headers: requestHeaders() });
}

export async function confirmCustomerDatabaseMigration(databaseId, migrationId) {
  return fetchJson(root(`/${databaseId}/migrations/${migrationId}/confirm`), {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({}),
  });
}

export function useCustomerDatabases(options = {}) {
  return useResource(() => listCustomerDatabases(), [], {
    pollMs: options.pollMs ?? 15000,
  });
}
