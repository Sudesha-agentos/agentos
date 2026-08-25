import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isJiraMirroredWorkItem,
  isLocalOnlyWorkItem,
  mapJiraStatusToColumnSlug,
} from "./jiraStatusMap";

describe("mapJiraStatusToColumnSlug", () => {
  it("maps empty status to backlog", () => {
    assert.equal(mapJiraStatusToColumnSlug(""), "backlog");
    assert.equal(mapJiraStatusToColumnSlug("   "), "backlog");
  });

  it("maps AI Worker and configured intake statuses", () => {
    assert.equal(mapJiraStatusToColumnSlug("AI Worker"), "ai_worker");
    assert.equal(mapJiraStatusToColumnSlug("ai_worker"), "ai_worker");
    assert.equal(mapJiraStatusToColumnSlug("AgentOX", ["AgentOX"]), "ai_worker");
  });

  it("maps done-like statuses", () => {
    assert.equal(mapJiraStatusToColumnSlug("Done"), "done");
    assert.equal(mapJiraStatusToColumnSlug("Closed"), "done");
    assert.equal(mapJiraStatusToColumnSlug("Resolved"), "done");
    assert.equal(mapJiraStatusToColumnSlug("Cancelled"), "done");
    assert.equal(mapJiraStatusToColumnSlug("Complete"), "done");
  });

  it("maps review and QA statuses", () => {
    assert.equal(mapJiraStatusToColumnSlug("In Review"), "review");
    assert.equal(mapJiraStatusToColumnSlug("Code Review"), "review");
    assert.equal(mapJiraStatusToColumnSlug("QA"), "review");
    assert.equal(mapJiraStatusToColumnSlug("Awaiting Human"), "review");
  });

  it("maps in-progress statuses", () => {
    assert.equal(mapJiraStatusToColumnSlug("In Progress"), "in_progress");
    assert.equal(mapJiraStatusToColumnSlug("In Development"), "in_progress");
    assert.equal(mapJiraStatusToColumnSlug("Doing"), "in_progress");
  });

  it("maps ready / to-do statuses", () => {
    assert.equal(mapJiraStatusToColumnSlug("Ready"), "ready");
    assert.equal(mapJiraStatusToColumnSlug("To Do"), "ready");
    assert.equal(mapJiraStatusToColumnSlug("To-Do"), "ready");
    assert.equal(mapJiraStatusToColumnSlug("Selected for Development"), "ready");
  });

  it("maps backlog / open / new as backlog", () => {
    assert.equal(mapJiraStatusToColumnSlug("Backlog"), "backlog");
    assert.equal(mapJiraStatusToColumnSlug("Open"), "backlog");
    assert.equal(mapJiraStatusToColumnSlug("New"), "backlog");
  });

  it("prefers review over ready when both words appear", () => {
    assert.equal(mapJiraStatusToColumnSlug("Ready for review"), "review");
  });
});

describe("isLocalOnlyWorkItem", () => {
  it("treats jira source as mirrored, not local-only", () => {
    assert.equal(isJiraMirroredWorkItem({ source: "jira" }), true);
    assert.equal(isLocalOnlyWorkItem({ source: "jira", key: "PROJ-12" }), false);
  });

  it("treats spreadsheet and manual WB cards as local-only", () => {
    assert.equal(isLocalOnlyWorkItem({ source: "excel", key: "WB-1" }), true);
    assert.equal(isLocalOnlyWorkItem({ source: "manual", key: "WB-2" }), true);
    assert.equal(isJiraMirroredWorkItem({ source: "manual" }), false);
  });
});
