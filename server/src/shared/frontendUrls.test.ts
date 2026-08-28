import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  frontendBaseUrl,
  frontendIntegrationUrl,
} from "./frontendUrls";

describe("frontendIntegrationUrl", () => {
  it("builds org-scoped integration paths", () => {
    const prev = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = "https://app.example.com/app";
    try {
      assert.equal(
        frontendIntegrationUrl("acme", "github"),
        "https://app.example.com/acme/integrations/github"
      );
      assert.equal(
        frontendIntegrationUrl("acme", "bitbucket"),
        "https://app.example.com/acme/integrations/bitbucket"
      );
      assert.equal(
        frontendIntegrationUrl("acme", "jira"),
        "https://app.example.com/acme/integrations/jira"
      );
      assert.equal(frontendBaseUrl(), "https://app.example.com");
    } finally {
      if (prev === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = prev;
    }
  });

  it("rewrites legacy agentos-blue FRONTEND_URL to agentox.io", () => {
    const prev = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = "https://agentos-blue.vercel.app";
    try {
      assert.equal(frontendBaseUrl(), "https://agentox.io");
    } finally {
      if (prev === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = prev;
    }
  });

  it("defaults to agentox.io for App Runner PUBLIC_API_URL", () => {
    const prevFrontend = process.env.FRONTEND_URL;
    const prevApi = process.env.PUBLIC_API_URL;
    const prevEnv = process.env.NODE_ENV;
    delete process.env.FRONTEND_URL;
    process.env.PUBLIC_API_URL = "https://abcd.us-east-1.awsapprunner.com";
    process.env.NODE_ENV = "development";
    try {
      assert.equal(frontendBaseUrl(), "https://agentox.io");
    } finally {
      if (prevFrontend === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = prevFrontend;
      if (prevApi === undefined) delete process.env.PUBLIC_API_URL;
      else process.env.PUBLIC_API_URL = prevApi;
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
    }
  });
});
