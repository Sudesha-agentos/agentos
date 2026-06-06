/**
 * Generates pipeline-ready demo assets:
 *   scripts/horizon-commerce-jira-import.csv  — Epic → Story → Sub-task hierarchy
 *   demo/horizon-commerce-platform/demo/jira-mapping.json — ticket ↔ code map
 *
 * Run: node scripts/generate-pipeline-demo.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CSV_OUT = join(__dirname, "pipeline-demo-jira-import.csv");
const CSV_LEGACY = join(__dirname, "horizon-commerce-jira-import.csv");
const MAP_OUT = join(
  ROOT,
  "demo/horizon-commerce-platform/demo/jira-mapping.json"
);

function esc(val) {
  if (val == null) return '""';
  return `"${String(val).replace(/"/g, '""')}"`;
}

function storyDescription(opts) {
  const { persona, want, benefit, context, acceptance, technical, codebase } =
    opts;
  const lines = [
    `*User story*`,
    `As a ${persona}, I want ${want} so that ${benefit}.`,
    ``,
    `*Background*`,
    context,
    ``,
    `*Acceptance criteria*`,
    ...acceptance.map((a, i) => `${i + 1}. ${a}`),
  ];
  if (technical?.length) {
    lines.push(``, `*Technical notes*`, ...technical.map((t) => `- ${t}`));
  }
  if (codebase?.length) {
    lines.push(``, `*Codebase*`, ...codebase.map((c) => `- ${c}`));
  }
  return lines.join("\n");
}

function subtaskDescription(opts) {
  const { goal, files, done, steps } = opts;
  return [
    `*Goal*`,
    goal,
    ``,
    `*Target files*`,
    ...files.map((f) => `- ${f}`),
    ``,
    `*Implementation steps*`,
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `*Definition of done*`,
    ...done.map((d) => `- ${d}`),
  ].join("\n");
}

const EPICS = [
  {
    id: "HC-EPIC-01",
    summary: "Merchant onboarding & KYC verification",
    description:
      "Enable B2B merchants to register, upload KYC documents, and pass verification before accepting payments. Demo epic for AgentOS pipeline — move to AI Worker to queue all child stories and subtasks.",
    components: ["Frontend", "Backend"],
  },
  {
    id: "HC-EPIC-02",
    summary: "Checkout, payments & settlement",
    description:
      "Checkout idempotency, signed webhooks, and finance CSV exports. Contains intentional bugs in horizon-commerce-platform for the engineering agent to fix.",
    components: ["Payments", "Backend"],
  },
];

const ROWS = [];

function addRow(r) {
  ROWS.push({
    labels: ["horizon-commerce", "agentos-demo", "pipeline-demo"],
    ...r,
  });
}

for (const epic of EPICS) {
  addRow({
    workItemId: epic.id,
    summary: epic.summary,
    description: epic.description,
    issueType: "Epic",
    priority: "High",
    status: "To Do",
    resolution: "",
    components: epic.components,
    parent: "",
    reporter: "Sarah Chen",
    created: "02/06/25 10:00",
  });
}

// ── Epic 01: Onboarding ─────────────────────────────────────────────────────

addRow({
  workItemId: "HC-101",
  summary: "Guided onboarding wizard with save-and-resume",
  description: storyDescription({
    persona: "merchant admin",
    want: "a 4-step onboarding wizard that saves my progress",
    benefit: "I can complete KYC over multiple sessions without data loss",
    context:
      "Horizon Commerce onboarding drops off at document upload. The demo repo has partial draft support in onboardingService.ts but no step model.",
    acceptance: [
      "Given a new merchant, when onboarding starts, then 4 steps are returned (business info, documents, review, confirmation).",
      "Given I save step 2, when I return within 7 days, then my draft restores at step 2.",
      "Given a document URL over 10MB, when I save, then validation rejects before persist.",
    ],
    technical: [
      "Draft TTL from config.onboardingDraftTtlDays",
      "Audit every draft save via recordAudit",
    ],
    codebase: [
      "demo/horizon-commerce-platform/src/modules/merchant/onboardingService.ts",
      "demo/horizon-commerce-platform/src/modules/merchant/wizardSteps.ts (stub — needs 4 steps)",
    ],
  }),
  issueType: "Story",
  priority: "Highest",
  status: "To Do",
  resolution: "",
  components: ["Frontend", "Backend"],
  parent: "HC-EPIC-01",
  reporter: "Sarah Chen",
  created: "02/06/25 11:00",
});

addRow({
  workItemId: "HC-101-1",
  summary: "Implement onboarding draft persistence API",
  description: subtaskDescription({
    goal: "Persist merchant onboarding drafts with step index and document list.",
    files: [
      "src/modules/merchant/onboardingService.ts",
      "src/lib/audit.ts",
    ],
    steps: [
      "Ensure saveDraft stores step (1-4), documents[], updatedAt",
      "Ensure loadDraft respects onboardingDraftTtlDays and clears expired drafts",
      "Record audit entry onboarding.draft_saved on each save",
    ],
    done: [
      "Unit-level manual test: save then load returns same step",
      "Expired draft returns null after TTL",
    ],
  }),
  issueType: "Sub-task",
  priority: "High",
  status: "To Do",
  resolution: "",
  components: ["Backend"],
  parent: "HC-101",
  reporter: "Sarah Chen",
  created: "02/06/25 11:05",
});

addRow({
  workItemId: "HC-101-2",
  summary: "Add 4-step wizard step definitions",
  description: subtaskDescription({
    goal: "Expose getWizardSteps() returning four ordered steps for the merchant portal.",
    files: ["src/modules/merchant/wizardSteps.ts", "src/index.ts"],
    steps: [
      "Define WizardStep type with id, title, description",
      "Return steps: business_info, documents, review, confirmation",
      "Export from src/index.ts",
    ],
    done: [
      "getWizardSteps().length === 4",
      "Step ids are stable strings for UI routing",
    ],
  }),
  issueType: "Sub-task",
  priority: "High",
  status: "To Do",
  resolution: "",
  components: ["Frontend", "Backend"],
  parent: "HC-101",
  reporter: "Marcus Webb",
  created: "02/06/25 11:10",
});

addRow({
  workItemId: "HC-101-3",
  summary: "Fix document size validation on onboarding upload",
  description: subtaskDescription({
    goal: "Validate uploaded document byte size, not URL string length.",
    files: [
      "src/modules/merchant/onboardingService.ts",
      "src/modules/merchant/kycValidator.ts",
    ],
    steps: [
      "Change saveDraft to accept documentSizesBytes: number[] parallel to documents",
      "Reject any file over config.maxUploadBytes with KycValidationError",
      "Add validateDocumentSizes helper in kycValidator.ts",
    ],
    done: [
      "10MB+ file rejected with clear error",
      "Valid sizes persist normally",
    ],
  }),
  issueType: "Sub-task",
  priority: "Medium",
  status: "To Do",
  resolution: "",
  components: ["Backend"],
  parent: "HC-101",
  reporter: "Priya Nair",
  created: "02/06/25 11:15",
});

addRow({
  workItemId: "HC-102",
  summary: "Role-based access control for merchant team",
  description: storyDescription({
    persona: "org owner",
    want: "to assign viewer, editor, billing, and owner roles",
    benefit: "my team has least-privilege access to refunds and API keys",
    context:
      "assignRole exists but there is no central permission guard. Support and finance roles need different capabilities.",
    acceptance: [
      "Given Viewer role, when user attempts refund, then action is denied.",
      "Given Editor role, when user creates API key, then action is denied.",
      "Given role change, when saved, then audit log records actor and target.",
    ],
    codebase: [
      "src/modules/merchant/onboardingService.ts",
      "src/modules/merchant/permissionGuard.ts (stub)",
    ],
  }),
  issueType: "Story",
  priority: "High",
  status: "To Do",
  resolution: "",
  components: ["Backend", "Security"],
  parent: "HC-EPIC-01",
  reporter: "James Okafor",
  created: "02/06/25 12:00",
});

addRow({
  workItemId: "HC-102-1",
  summary: "Extend assignRole with invite metadata",
  description: subtaskDescription({
    goal: "Track who assigned each role and when for audit compliance.",
    files: ["src/modules/merchant/onboardingService.ts", "src/lib/audit.ts"],
    steps: [
      "Add assignRoleBy(actorId, userId, role) that records actor in audit",
      "Keep assignRole as wrapper for backward compatibility",
    ],
    done: ["Audit entry includes actor, target, role"],
  }),
  issueType: "Sub-task",
  priority: "Medium",
  status: "To Do",
  resolution: "",
  components: ["Backend"],
  parent: "HC-102",
  reporter: "James Okafor",
  created: "02/06/25 12:05",
});

addRow({
  workItemId: "HC-102-2",
  summary: "Implement permissionGuard for refund and API key actions",
  description: subtaskDescription({
    goal: "Central guard used by refundService and API routes.",
    files: [
      "src/modules/merchant/permissionGuard.ts",
      "src/modules/orders/refundService.ts",
    ],
    steps: [
      "Implement assertCan(userId, action) for refund, api_key_create, view_pii",
      "Wire refundService to call assertCan before processing",
      "Viewer and billing roles cannot refund",
    ],
    done: ["Unauthorized refund throws with clear message"],
  }),
  issueType: "Sub-task",
  priority: "High",
  status: "To Do",
  resolution: "",
  components: ["Backend", "Security"],
  parent: "HC-102",
  reporter: "Elena Vasquez",
  created: "02/06/25 12:10",
});

addRow({
  workItemId: "HC-103",
  summary: "Presigned S3 URLs for KYC document upload",
  description: storyDescription({
    persona: "merchant admin",
    want: "presigned upload URLs for KYC documents",
    benefit: "large files upload directly to S3 without hitting API body limits",
    context:
      "documentUpload.ts is a stub. Production uses S3; demo uses fake presign URLs.",
    acceptance: [
      "Given merchantId and filename, when presign requested, then URL expires in 15 minutes.",
      "Given invalid content type, when presign requested, then request is rejected.",
    ],
    codebase: ["src/modules/merchant/documentUpload.ts (stub)"],
  }),
  issueType: "Story",
  priority: "High",
  status: "To Do",
  resolution: "",
  components: ["Backend"],
  parent: "HC-EPIC-01",
  reporter: "Tom Bradley",
  created: "02/06/25 13:00",
});

addRow({
  workItemId: "HC-103-1",
  summary: "Implement createPresignedUploadUrl in documentUpload.ts",
  description: subtaskDescription({
    goal: "Return demo-safe presigned URL structure for KYC uploads.",
    files: ["src/modules/merchant/documentUpload.ts"],
    steps: [
      "Add createPresignedUploadUrl(merchantId, filename, contentType, sizeBytes)",
      "Reject sizeBytes > config.maxUploadBytes",
      "Return { url, expiresAt, fields } demo object",
    ],
    done: ["Oversized file rejected", "Valid request returns url and expiresAt"],
  }),
  issueType: "Sub-task",
  priority: "High",
  status: "To Do",
  resolution: "",
  components: ["Backend"],
  parent: "HC-103",
  reporter: "Tom Bradley",
  created: "02/06/25 13:05",
});

// ── Epic 02: Payments ───────────────────────────────────────────────────────

addRow({
  workItemId: "HC-201",
  summary: "Fix duplicate charge on double-click Pay",
  description: storyDescription({
    persona: "shopper",
    want: "checkout to charge my card only once",
    benefit: "I am not double-billed when I double-click Pay",
    context:
      "KNOWN BUG in checkoutService.ts — idempotency was removed for demo. processCheckout creates a new chargeId on every call.",
    acceptance: [
      "Given same idempotencyKey, when checkout called twice, then second call returns same charge or rejects duplicate.",
      "Given different keys, when checkout called, then separate charges are created.",
    ],
    codebase: [
      "src/modules/payments/checkoutService.ts",
      "apps/merchant-portal/src/checkoutButton.ts (stub debounce)",
    ],
  }),
  issueType: "Story",
  priority: "Highest",
  status: "To Do",
  resolution: "",
  components: ["Payments", "Frontend"],
  parent: "HC-EPIC-02",
  reporter: "Marcus Webb",
  created: "02/06/25 14:00",
});

addRow({
  workItemId: "HC-201-1",
  summary: "Restore idempotency key handling in processCheckout",
  description: subtaskDescription({
    goal: "Prevent duplicate charges for the same idempotencyKey.",
    files: [
      "src/modules/payments/checkoutService.ts",
      "src/lib/errors.ts",
      "test/checkout.test.js",
    ],
    steps: [
      "Track processed idempotency keys in memory Set",
      "Throw PaymentDuplicateError on duplicate key",
      "Return stable chargeId for first successful charge",
      "Update test to assert duplicate is rejected",
    ],
    done: ["Duplicate key throws PaymentDuplicateError", "Tests pass"],
  }),
  issueType: "Sub-task",
  priority: "Highest",
  status: "To Do",
  resolution: "",
  components: ["Payments", "Backend"],
  parent: "HC-201",
  reporter: "Marcus Webb",
  created: "02/06/25 14:05",
});

addRow({
  workItemId: "HC-201-2",
  summary: "Add Pay button debounce in merchant portal",
  description: subtaskDescription({
    goal: "Disable Pay button for 2s after first click to reduce duplicate submits.",
    files: ["apps/merchant-portal/src/checkoutButton.ts"],
    steps: [
      "Implement createCheckoutButtonHandler(onPay) returning debounced handler",
      "Use 2000ms window",
      "Export for portal integration",
    ],
    done: ["Rapid double invoke only calls onPay once within 2s"],
  }),
  issueType: "Sub-task",
  priority: "Medium",
  status: "To Do",
  resolution: "",
  components: ["Frontend"],
  parent: "HC-201",
  reporter: "Priya Nair",
  created: "02/06/25 14:10",
});

addRow({
  workItemId: "HC-202",
  summary: "Fix webhook signature for payloads over 64KB",
  description: storyDescription({
    persona: "integration engineer",
    want: "webhook signatures to validate on large order payloads",
    benefit: "ERP sync works for large B2B orders",
    context:
      "BUG: verifySignature truncates body at 64KB before HMAC. Large orders fail validation despite correct secret.",
    acceptance: [
      "Given 200-line-item payload, when signature verified with SDK, then validation passes.",
      "Given tampered payload, when verified, then validation fails.",
    ],
    codebase: ["src/modules/payments/webhookDispatcher.ts"],
  }),
  issueType: "Story",
  priority: "High",
  status: "To Do",
  resolution: "",
  components: ["Payments", "API"],
  parent: "HC-EPIC-02",
  reporter: "James Okafor",
  created: "02/06/25 15:00",
});

addRow({
  workItemId: "HC-202-1",
  summary: "Sign and verify full webhook body regardless of size",
  description: subtaskDescription({
    goal: "Remove 64KB truncation from verifySignature and signPayload usage.",
    files: ["src/modules/payments/webhookDispatcher.ts"],
    steps: [
      "Remove body.slice(0, 65536) truncation",
      "Use full body string for HMAC in signPayload and verifySignature",
      "Add comment referencing HC-202",
    ],
    done: ["Payloads >64KB validate correctly with matching secret"],
  }),
  issueType: "Sub-task",
  priority: "High",
  status: "To Do",
  resolution: "",
  components: ["Payments", "Backend"],
  parent: "HC-202",
  reporter: "James Okafor",
  created: "02/06/25 15:05",
});

addRow({
  workItemId: "HC-203",
  summary: "Settlement CSV export with date range filter",
  description: storyDescription({
    persona: "finance analyst",
    want: "CSV export of settlements filtered by date range",
    benefit: "month-end close does not require manual copy-paste",
    context:
      "toSettlementCsv exists but lacks date filtering. exportSettlementsByDate is stubbed.",
    acceptance: [
      "Given start and end date, when export runs, then only rows in range are included.",
      "Given empty range, when export runs, then CSV has headers only.",
    ],
    codebase: [
      "src/modules/payments/settlementReporter.ts",
      "src/modules/analytics/exportService.ts",
    ],
  }),
  issueType: "Story",
  priority: "Medium",
  status: "To Do",
  resolution: "",
  components: ["Payments", "Data"],
  parent: "HC-EPIC-02",
  reporter: "Elena Vasquez",
  created: "02/06/25 16:00",
});

addRow({
  workItemId: "HC-203-1",
  summary: "Implement exportSettlementsByDate in settlementReporter",
  description: subtaskDescription({
    goal: "Filter settlement rows by settlementDate inclusive range and return CSV.",
    files: ["src/modules/payments/settlementReporter.ts"],
    steps: [
      "Add exportSettlementsByDate(rows, startDate, endDate)",
      "Parse settlementDate as ISO date strings",
      "Reuse toSettlementCsv for output",
    ],
    done: ["In-range rows exported", "Out-of-range rows excluded"],
  }),
  issueType: "Sub-task",
  priority: "Medium",
  status: "To Do",
  resolution: "",
  components: ["Payments", "Backend"],
  parent: "HC-203",
  reporter: "Elena Vasquez",
  created: "02/06/25 16:05",
});

// Mirror/RAG samples (Done — picked up by mirror backfill)
addRow({
  workItemId: "HC-099",
  summary: "[DONE] Audit log export for compliance",
  description:
    "Completed reference ticket for RAG mirror. Implemented in src/lib/audit.ts listAudit(). Used as historical context during discovery.",
  issueType: "Story",
  priority: "Medium",
  status: "Done",
  resolution: "Done",
  components: ["Security", "Backend"],
  parent: "HC-EPIC-01",
  reporter: "Sarah Chen",
  created: "01/06/25 10:00",
});

const header = [
  "Work item id",
  "Summary",
  "Description",
  "Issue Type",
  "Priority",
  "Status",
  "Resolution",
  "Labels",
  "Labels",
  "Labels",
  "Component",
  "Component",
  "Parent",
  "Reporter",
  "Created",
];

const lines = [header.join(",")];
for (const r of ROWS) {
  const labels = r.labels;
  const comps = r.components ?? [];
  lines.push(
    [
      esc(r.workItemId),
      esc(r.summary),
      esc(r.description),
      esc(r.issueType),
      esc(r.priority),
      esc(r.status),
      esc(r.resolution ?? ""),
      esc(labels[0] ?? ""),
      esc(labels[1] ?? ""),
      esc(labels[2] ?? ""),
      esc(comps[0] ?? ""),
      esc(comps[1] ?? ""),
      esc(r.parent ?? ""),
      esc(r.reporter),
      esc(r.created),
    ].join(",")
  );
}

writeFileSync(CSV_OUT, lines.join("\n"), "utf8");
try {
  writeFileSync(CSV_LEGACY, lines.join("\n"), "utf8");
} catch (err) {
  console.warn(`Could not update ${CSV_LEGACY} (${err.message}) — use ${CSV_OUT}`);
}

const mapping = {
  version: 1,
  name: "Horizon Commerce Pipeline Demo",
  jiraProjectKey: "SCRUM",
  githubRepo: "ZoroXRoronoa/horizon-commerce-platform",
  localRepoPath: "demo/horizon-commerce-platform",
  intakeStatus: "AI Worker",
  workflow: {
    moveEpicToAiWorker:
      "Decomposes to stories, then subtasks, queued one-at-a-time per story group",
    recommendedFirstEpic: "HC-EPIC-02",
  },
  epics: EPICS.map((e) => ({
    workItemId: e.id,
    summary: e.summary,
    module: e.id === "HC-EPIC-01" ? "src/modules/merchant/" : "src/modules/payments/",
  })),
  stories: ROWS.filter((r) => r.issueType === "Story").map((r) => ({
    workItemId: r.workItemId,
    parent: r.parent,
    summary: r.summary,
    status: r.status,
  })),
  subtasks: ROWS.filter((r) => r.issueType === "Sub-task").map((r) => ({
    workItemId: r.workItemId,
    parent: r.parent,
    summary: r.summary,
  })),
};

mkdirSync(dirname(MAP_OUT), { recursive: true });
writeFileSync(MAP_OUT, JSON.stringify(mapping, null, 2), "utf8");

console.log(`Wrote ${ROWS.length} Jira rows → ${CSV_OUT}`);
if (CSV_OUT !== CSV_LEGACY) {
  console.log(`(Also attempted ${CSV_LEGACY})`);
}
console.log(`Wrote mapping → ${MAP_OUT}`);
