/**
 * Generates demo/horizon-commerce-platform — dummy GitHub repo for AgentOS demos.
 * Aligns with Horizon Commerce Jira epics (HC-EPIC-01 … 08) and SCRUM project.
 */
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "demo", "horizon-commerce-platform");

function write(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
}

if (existsSync(ROOT)) {
  console.log("Target exists — overwriting files (keep .git if present)");
}

write(
  "README.md",
  `# Horizon Commerce Platform

Dummy B2B e-commerce and payments monorepo for **AgentOS** demos. Pairs with the Horizon Commerce Jira import (\`scripts/horizon-commerce-jira-import.csv\`).

## Company profile

**Horizon Commerce** sells payment and order infrastructure to mid-market merchants. This repo implements the core platform services referenced in Jira epics:

| Epic | Module |
|------|--------|
| HC-EPIC-01 Merchant onboarding & KYC | \`src/modules/merchant/\` |
| HC-EPIC-02 Checkout & payments | \`src/modules/payments/\` |
| HC-EPIC-03 Order management | \`src/modules/orders/\` |
| HC-EPIC-04 Catalog & inventory | \`src/modules/catalog/\` |
| HC-EPIC-05 Analytics dashboard | \`src/modules/analytics/\` |
| HC-EPIC-06 Public API | \`src/modules/api/\` |
| HC-EPIC-07 Security & fraud | \`src/modules/security/\` |
| HC-EPIC-08 Mobile seller app | \`apps/mobile-seller/\` |

## Stack

- TypeScript / Node.js
- Express-style route handlers (stub)
- PostgreSQL-oriented services (in-memory stubs for demo)

## AgentOS setup

1. Connect this repo via **GitHub App** in AgentOS Settings → Git Integration
2. Set \`GITHUB_REPO_OWNER\` / \`GITHUB_REPO_NAME\` or install the app on this repository
3. Run codebase index from the dashboard
4. Link Jira **SCRUM** project via Lane 2 pipeline Jira settings
5. Mirror backfill pulls closed Jira tickets; commit messages include \`SCRUM-XXX\` keys for traceability

## Local dev (optional)

\`\`\`bash
npm install
npm run typecheck
\`\`\`

> Demo repository — not production code.
`
);

write(
  "package.json",
  JSON.stringify(
    {
      name: "horizon-commerce-platform",
      version: "0.1.0",
      private: true,
      description: "Horizon Commerce B2B payments platform (AgentOS demo)",
      scripts: {
        typecheck: "tsc -p tsconfig.json --noEmit",
        test: "node --test test/**/*.test.js",
      },
      engines: { node: ">=20" },
      devDependencies: {
        typescript: "^5.7.0",
        "@types/node": "^22.0.0",
      },
    },
    null,
    2
  )
);

write(
  "tsconfig.json",
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        outDir: "dist",
        rootDir: "src",
        declaration: true,
      },
      include: ["src/**/*.ts", "apps/**/*.ts"],
    },
    null,
    2
  )
);

write(
  ".gitignore",
  `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
`
);

write(
  "docs/architecture.md",
  `# Architecture

Horizon Commerce is a modular monolith deployed as a single API service with optional worker processes.

## Services

- **API gateway** (\`src/modules/api/\`) — OAuth, rate limits, REST v1
- **Merchant** — onboarding sessions, KYC document upload, role-based access
- **Payments** — checkout, idempotent charge, webhooks, settlement CSV
- **Orders** — cart, capture, refunds, partial fulfillment
- **Catalog** — SKU variants, B2B tier pricing, stock reservations
- **Analytics** — GMV rollups, scheduled exports
- **Security** — fraud scoring, audit log, PII masking

## Data stores

- PostgreSQL — transactional data
- Redis — webhook delivery queue, rate limit counters
- S3 — KYC document storage

## Integration points

- Jira SCRUM project for product workflow (AgentOS Lane 2)
- GitHub push webhooks → AgentOS codebase intelligence index
`
);

write(
  "src/config.ts",
  `export const config = {
  appName: "horizon-commerce",
  apiVersion: "v1",
  defaultCurrency: "USD",
  webhookSignatureHeader: "X-Horizon-Signature",
  onboardingDraftTtlDays: 7,
  maxUploadBytes: 10 * 1024 * 1024,
  rateLimitPerMinute: 100,
  mirrorEligibleStatuses: ["Done", "Closed", "Resolved"],
} as const;

export type AppConfig = typeof config;
`
);

write(
  "src/lib/errors.ts",
  `export class HorizonError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = "HorizonError";
  }
}

export class PaymentDuplicateError extends HorizonError {
  constructor(idempotencyKey: string) {
    super(\`Duplicate charge for key \${idempotencyKey}\`, "payment_duplicate", 409);
  }
}

export class KycValidationError extends HorizonError {
  constructor(reason: string) {
    super(reason, "kyc_invalid", 422);
  }
}
`
);

write(
  "src/lib/audit.ts",
  `export interface AuditEntry {
  actor: string;
  action: string;
  target: string;
  metadata?: Record<string, unknown>;
  at: Date;
}

const log: AuditEntry[] = [];

export function recordAudit(entry: Omit<AuditEntry, "at">): void {
  log.push({ ...entry, at: new Date() });
}

export function listAudit(limit = 50): AuditEntry[] {
  return log.slice(-limit);
}
`
);

write(
  "src/modules/merchant/onboardingService.ts",
  `import { config } from "../../config.js";
import { KycValidationError } from "../../lib/errors.js";
import { recordAudit } from "../../lib/audit.js";

export interface OnboardingDraft {
  merchantId: string;
  step: number;
  documents: string[];
  updatedAt: Date;
}

const drafts = new Map<string, OnboardingDraft>();

/** SCRUM: guided onboarding wizard with save-and-resume (HC-EPIC-01) */
export function saveDraft(merchantId: string, step: number, documents: string[]): OnboardingDraft {
  if (documents.some((d) => d.length > config.maxUploadBytes)) {
    throw new KycValidationError("Document exceeds 10MB limit");
  }
  const draft: OnboardingDraft = {
    merchantId,
    step,
    documents,
    updatedAt: new Date(),
  };
  drafts.set(merchantId, draft);
  recordAudit({ actor: merchantId, action: "onboarding.draft_saved", target: merchantId, metadata: { step } });
  return draft;
}

export function loadDraft(merchantId: string): OnboardingDraft | null {
  const draft = drafts.get(merchantId);
  if (!draft) return null;
  const ageMs = Date.now() - draft.updatedAt.getTime();
  if (ageMs > config.onboardingDraftTtlDays * 86400000) {
    drafts.delete(merchantId);
    return null;
  }
  return draft;
}

export type MerchantRole = "owner" | "editor" | "viewer" | "billing";

const roles = new Map<string, MerchantRole>();

export function assignRole(userId: string, role: MerchantRole): void {
  roles.set(userId, role);
  recordAudit({ actor: "system", action: "role.assigned", target: userId, metadata: { role } });
}

export function canRefund(userId: string): boolean {
  const role = roles.get(userId);
  return role === "owner" || role === "editor";
}
`
);

write(
  "src/modules/merchant/kycValidator.ts",
  `import { KycValidationError } from "../../lib/errors.js";

export interface KycPayload {
  businessName: string;
  taxId: string;
  documentUrls: string[];
}

export function validateKyc(payload: KycPayload): void {
  if (!payload.businessName.trim()) {
    throw new KycValidationError("Business name is required");
  }
  if (!/^\\d{2}-\\d{7}$/.test(payload.taxId)) {
    throw new KycValidationError("Tax ID must match XX-XXXXXXX format");
  }
  if (!payload.documentUrls.length) {
    throw new KycValidationError("At least one KYC document is required");
  }
}

export function kycRiskScore(payload: KycPayload): number {
  let score = 0;
  if (payload.documentUrls.length < 2) score += 30;
  if (payload.businessName.length < 3) score += 20;
  return Math.min(100, score);
}
`
);

write(
  "src/modules/payments/checkoutService.ts",
  `import { PaymentDuplicateError } from "../../lib/errors.js";

const processedKeys = new Set<string>();

export interface CheckoutRequest {
  cartId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
}

export interface CheckoutResult {
  chargeId: string;
  status: "authorized" | "failed";
}

/** Idempotent checkout — fixes double-click duplicate charge (SCRUM bug) */
export function processCheckout(req: CheckoutRequest): CheckoutResult {
  if (processedKeys.has(req.idempotencyKey)) {
    throw new PaymentDuplicateError(req.idempotencyKey);
  }
  processedKeys.add(req.idempotencyKey);
  return {
    chargeId: \`ch_\${req.idempotencyKey.slice(0, 12)}\`,
    status: "authorized",
  };
}
`
);

write(
  "src/modules/payments/webhookDispatcher.ts",
  `import crypto from "node:crypto";
import { config } from "../../config.js";

export interface WebhookEvent {
  type: string;
  payload: Record<string, unknown>;
}

export function signPayload(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function verifySignature(body: string, secret: string, header: string | undefined): boolean {
  if (!header) return false;
  const expected = signPayload(body, secret);
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

/** Delivers signed webhook — large payloads must not truncate signature input */
export function buildDeliveryHeaders(body: string, secret: string): Record<string, string> {
  return {
    [config.webhookSignatureHeader]: signPayload(body, secret),
    "Content-Type": "application/json",
  };
}
`
);

write(
  "src/modules/payments/settlementReporter.ts",
  `export interface SettlementRow {
  transactionId: string;
  amountCents: number;
  feeCents: number;
  status: string;
  settlementDate: string;
}

export function toSettlementCsv(rows: SettlementRow[]): string {
  const header = "transaction_id,amount_cents,fee_cents,status,settlement_date";
  const lines = rows.map(
    (r) =>
      \`\${r.transactionId},\${r.amountCents},\${r.feeCents},\${r.status},\${r.settlementDate}\`
  );
  return [header, ...lines].join("\\n");
}
`
);

write(
  "src/modules/orders/orderService.ts",
  `export type OrderStatus = "pending" | "paid" | "fulfilled" | "refunded" | "partial";

export interface Order {
  id: string;
  merchantId: string;
  totalCents: number;
  status: OrderStatus;
  lineItems: Array<{ sku: string; qty: number }>;
}

const orders = new Map<string, Order>();

export function createOrder(input: Omit<Order, "id" | "status">): Order {
  const order: Order = {
    id: \`ord_\${Date.now()}\`,
    status: "pending",
    ...input,
  };
  orders.set(order.id, order);
  return order;
}

export function capturePayment(orderId: string): Order {
  const order = orders.get(orderId);
  if (!order) throw new Error("Order not found");
  order.status = "paid";
  return order;
}
`
);

write(
  "src/modules/orders/refundService.ts",
  `import { canRefund } from "../merchant/onboardingService.js";
import type { Order } from "./orderService.js";

export function refundOrder(order: Order, actorUserId: string, amountCents: number): Order {
  if (!canRefund(actorUserId)) {
    throw new Error("Insufficient permissions to refund");
  }
  if (amountCents > order.totalCents) {
    throw new Error("Refund exceeds order total");
  }
  order.status = amountCents === order.totalCents ? "refunded" : "partial";
  return order;
}
`
);

write(
  "src/modules/catalog/productService.ts",
  `export interface Product {
  sku: string;
  name: string;
  variants: Array<{ id: string; label: string; priceCents: number }>;
}

const catalog = new Map<string, Product>();

export function upsertProduct(product: Product): void {
  catalog.set(product.sku, product);
}

export function getProduct(sku: string): Product | undefined {
  return catalog.get(sku);
}
`
);

write(
  "src/modules/catalog/inventoryService.ts",
  `const stock = new Map<string, number>();
const reservations = new Map<string, number>();

export function reserveStock(sku: string, qty: number): boolean {
  const available = (stock.get(sku) ?? 0) - (reservations.get(sku) ?? 0);
  if (available < qty) return false;
  reservations.set(sku, (reservations.get(sku) ?? 0) + qty);
  return true;
}

export function setStockLevel(sku: string, qty: number): void {
  stock.set(sku, qty);
}

export function isLowStock(sku: string, threshold = 10): boolean {
  return (stock.get(sku) ?? 0) <= threshold;
}
`
);

write(
  "src/modules/catalog/pricingEngine.ts",
  `export interface TierRule {
  minQty: number;
  discountPct: number;
}

export function b2bPrice(baseCents: number, qty: number, tiers: TierRule[]): number {
  const tier = [...tiers].sort((a, b) => b.minQty - a.minQty).find((t) => qty >= t.minQty);
  if (!tier) return baseCents * qty;
  const unit = Math.round(baseCents * (1 - tier.discountPct / 100));
  return unit * qty;
}
`
);

write(
  "src/modules/analytics/metricsAggregator.ts",
  `export interface DailyGmv {
  date: string;
  merchantId: string;
  gmvCents: number;
  timezone: string;
}

/** Aggregate GMV — timezone-aware day boundaries (SCRUM analytics bug fix area) */
export function rollupGmv(rows: DailyGmv[], timezone: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    if (row.timezone !== timezone) continue;
    out.set(row.date, (out.get(row.date) ?? 0) + row.gmvCents);
  }
  return out;
}
`
);

write(
  "src/modules/analytics/exportService.ts",
  `export function scheduleWeeklyExport(merchantId: string, cronUtc: string): { jobId: string } {
  return { jobId: \`export_\${merchantId}_\${cronUtc.replace(/\\s+/g, "_")}\` };
}
`
);

write(
  "src/modules/api/routes.ts",
  `import type { CheckoutRequest } from "../payments/checkoutService.js";
import { processCheckout } from "../payments/checkoutService.js";
import { createOrder, capturePayment } from "../orders/orderService.js";

export const routes = {
  "POST /v1/checkout": (body: CheckoutRequest) => processCheckout(body),
  "POST /v1/orders": (body: Parameters<typeof createOrder>[0]) => createOrder(body),
  "POST /v1/orders/:id/capture": (orderId: string) => capturePayment(orderId),
} as const;
`
);

write(
  "src/modules/api/authMiddleware.ts",
  `export interface ApiToken {
  clientId: string;
  scopes: string[];
}

export function requireScope(token: ApiToken, scope: string): void {
  if (!token.scopes.includes(scope)) {
    throw new Error(\`Missing scope: \${scope}\`);
  }
}
`
);

write(
  "src/modules/api/rateLimiter.ts",
  `import { config } from "../../config.js";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(clientId: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = buckets.get(clientId) ?? { count: 0, resetAt: now + 60000 };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60000;
  }
  bucket.count += 1;
  buckets.set(clientId, bucket);
  if (bucket.count > config.rateLimitPerMinute) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true };
}
`
);

write(
  "src/modules/security/fraudScorer.ts",
  `export interface FraudSignals {
  ipCountry: string;
  velocity24h: number;
  newInstrument: boolean;
}

export function scoreTransaction(signals: FraudSignals): number {
  let score = 0;
  if (signals.velocity24h > 20) score += 40;
  if (signals.newInstrument) score += 25;
  if (signals.ipCountry === "XX") score += 35;
  return Math.min(100, score);
}

export function shouldBlock(score: number): boolean {
  return score >= 75;
}
`
);

write(
  "src/modules/security/piiMasker.ts",
  `export function maskCardPan(pan: string): string {
  const digits = pan.replace(/\\D/g, "");
  if (digits.length < 4) return "****";
  return \`**** **** **** \${digits.slice(-4)}\`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return \`\${user.slice(0, 2)}***@\${domain}\`;
}
`
);

write(
  "src/index.ts",
  `export { config } from "./config.js";
export * from "./modules/merchant/onboardingService.js";
export * from "./modules/payments/checkoutService.js";
export * from "./modules/orders/orderService.js";
export * from "./modules/catalog/productService.js";
export * from "./modules/analytics/metricsAggregator.js";
export { routes } from "./modules/api/routes.js";
`
);

write(
  "apps/mobile-seller/README.md",
  `# Mobile Seller App (HC-EPIC-08)

Field sales companion — offline catalog sync, quote capture, signature flow.

See \`src/syncService.ts\` for offline checkpoint resume logic (SCRUM mobile bug area).
`
);

write(
  "apps/mobile-seller/src/syncService.ts",
  `export interface SyncCheckpoint {
  merchantId: string;
  lastSku: string;
  updatedAt: Date;
}

let checkpoint: SyncCheckpoint | null = null;

/** Offline-first catalog sync with resume checkpoint */
export function saveCheckpoint(state: SyncCheckpoint): void {
  checkpoint = state;
}

export function resumeSync(): SyncCheckpoint | null {
  return checkpoint;
}

export async function syncCatalog(_merchantId: string): Promise<{ synced: number }> {
  if (!checkpoint) return { synced: 0 };
  return { synced: 42 };
}
`
);

write(
  "apps/merchant-portal/README.md",
  `# Merchant Portal

React admin UI for onboarding, analytics exports, and order search (HC-EPIC-01, HC-EPIC-05).
`
);

write(
  "test/checkout.test.js",
  `import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processCheckout } from "../dist/modules/payments/checkoutService.js";

describe("checkout idempotency", () => {
  it("rejects duplicate idempotency key", () => {
    const req = {
      cartId: "cart_1",
      amountCents: 25000,
      currency: "USD",
      idempotencyKey: "key_demo_1",
    };
    processCheckout(req);
    assert.throws(() => processCheckout(req), /Duplicate charge/);
  });
});
`
);

console.log(`Generated Horizon Commerce demo repo at ${ROOT}`);
