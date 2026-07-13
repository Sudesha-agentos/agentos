"""
Default Locust scaffold for AgentOX Canary (vendored stub — not the full Locust repo).
Upstream: https://github.com/locustio/locust (MIT)

Usage (headless):
  locust -f locustfile.py --headless -u 5 -r 1 -t 30s --host https://example.com
"""

from locust import HttpUser, task, between


class AgentOxCanaryUser(HttpUser):
    wait_time = between(0.5, 2.0)

    @task(3)
    def health(self):
        # Prefer common health paths; 404s still exercise the edge.
        for path in ("/api/health", "/health", "/"):
            with self.client.get(path, catch_response=True, name="healthish") as resp:
                if resp.status_code < 500:
                    resp.success()
                    return
                resp.failure(f"status {resp.status_code}")

    @task(1)
    def api_root(self):
        self.client.get("/api", name="api_root")
