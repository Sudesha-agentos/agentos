import crypto from "crypto";
import type { OrgRole } from "../../generated/prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
  organizationDomain?: string;
  organizationSlug?: string;
  organizationRole?: OrgRole;
};

type AuthTokenPayload = SessionUser & {
  issuedAt: string;
  exp: number;
  onboardingCompleted?: boolean;
};

const AUTH_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export type AuthSessionResponse = {
  token: string;
  issuedAt: string;
  user: SessionUser;
  organization?: {
    id: string;
    name: string;
    domain: string;
    slug: string;
    role: OrgRole;
  };
  onboardingCompleted: boolean;
};

function buildSessionResponse(
  token: string,
  payload: AuthTokenPayload
): AuthSessionResponse {
  const user: SessionUser = {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    organizationId: payload.organizationId,
    organizationName: payload.organizationName,
    organizationDomain: payload.organizationDomain,
    organizationSlug: payload.organizationSlug,
    organizationRole: payload.organizationRole,
  };

  const organization =
    payload.organizationId &&
    payload.organizationSlug &&
    payload.organizationName &&
    payload.organizationDomain &&
    payload.organizationRole
      ? {
          id: payload.organizationId,
          name: payload.organizationName,
          domain: payload.organizationDomain,
          slug: payload.organizationSlug,
          role: payload.organizationRole,
        }
      : undefined;

  return {
    token,
    issuedAt: payload.issuedAt,
    user,
    organization,
    onboardingCompleted: payload.onboardingCompleted ?? false,
  };
}

/** True when JWT already carries enough state — skip DB round-trip on GET /auth/session. */
export function canUseFastSessionPath(payload: AuthTokenPayload): boolean {
  if (typeof payload.onboardingCompleted !== "boolean") return false;

  if (!payload.onboardingCompleted) {
    return !payload.organizationId;
  }

  return Boolean(payload.organizationId && payload.organizationSlug);
}

export function resolveSessionFromAuthHeader(req: {
  header: (name: string) => string | undefined;
  query?: { token?: string };
}): AuthSessionResponse | null {
  const token = extractAuthToken(req);
  if (!token) return null;

  const payload = verifyAuthToken(token);
  if (!payload) return null;

  if (!canUseFastSessionPath(payload)) return null;

  return buildSessionResponse(token, payload);
}

const registeredEmails = new Set<string>(["demo@agentos.ai"]);

function authSecret(): string {
  return (
    process.env.AUTH_JWT_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "agentos-dev-auth-secret-change-in-production"
  );
}

const DEV_AUTH_SECRET = "agentos-dev-auth-secret-change-in-production";

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDemoLoginEnabled(): boolean {
  return !isProductionEnv() && process.env.AUTH_ENABLE_DEMO_LOGIN === "true";
}

export function isAnyLoginEnabled(): boolean {
  return !isProductionEnv() && process.env.AUTH_ALLOW_ANY_LOGIN === "true";
}

/** Refuse to boot when production is missing required secrets or has auth backdoors enabled. */
export function validateAuthConfig(): void {
  if (!isProductionEnv()) return;

  const secret = authSecret();
  if (secret === DEV_AUTH_SECRET) {
    throw new Error(
      "AUTH_JWT_SECRET is required in production. Set a unique secret before starting the API."
    );
  }
  if (process.env.AUTH_ALLOW_ANY_LOGIN === "true") {
    throw new Error("AUTH_ALLOW_ANY_LOGIN cannot be enabled in production.");
  }
  if (process.env.AUTH_ENABLE_DEMO_LOGIN === "true") {
    throw new Error("AUTH_ENABLE_DEMO_LOGIN cannot be enabled in production.");
  }
  if (!process.env.CORS_ORIGIN?.trim()) {
    throw new Error("CORS_ORIGIN is required in production.");
  }
  if (!process.env.LOG_SOURCE_ENCRYPTION_KEY?.trim()) {
    throw new Error("LOG_SOURCE_ENCRYPTION_KEY is required in production.");
  }
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signAuthToken(payload: AuthTokenPayload): string {
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", authSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac("sha256", authSecret())
    .update(body)
    .digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as AuthTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** @deprecated JWT auth no longer uses an in-memory session map. */
export function getSessionsMap() {
  return new Map<string, { user: SessionUser; issuedAt: string }>();
}

export function getRegisteredEmails() {
  return registeredEmails;
}

export function extractAuthToken(req: {
  header: (name: string) => string | undefined;
  query?: { token?: string };
}): string | undefined {
  const header = req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return undefined;
}

export function resolveUserFromAuthHeader(req: {
  header: (name: string) => string | undefined;
  query?: { token?: string };
}): SessionUser | null {
  const token = extractAuthToken(req);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload) return null;

  return {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    organizationId: payload.organizationId,
    organizationName: payload.organizationName,
    organizationDomain: payload.organizationDomain,
    organizationSlug: payload.organizationSlug,
    organizationRole: payload.organizationRole,
  };
}

export function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] || "operator";
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((segment) => segment[0].toUpperCase() + segment.slice(1))
      .join(" ") || "Workspace User"
  );
}

function sessionUserFromMembership(
  user: { id: string; email: string; name: string },
  membership: {
    organization: { id: string; name: string; domain: string; slug: string };
    role: OrgRole;
  } | null
): SessionUser {
  if (!membership) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationDomain: membership.organization.domain,
    organizationSlug: membership.organization.slug,
    organizationRole: membership.role,
  };
}

export async function issueSessionForUserId(userId: string) {
  const { prisma } = await import("../../db/client");
  const { getOrganizationForUser } = await import("../../organization/service");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const membership = await getOrganizationForUser(user.id);
  const sessionUser = sessionUserFromMembership(user, membership);

  const { getOnboarding } = await import("../../onboarding/store");
  const onboarding = await getOnboarding(sessionUser.id);
  const onboardingCompleted = onboarding?.completed ?? false;

  const issuedAt = new Date().toISOString();
  const exp = Math.floor(Date.now() / 1000) + AUTH_TOKEN_TTL_SECONDS;
  const token = signAuthToken({
    ...sessionUser,
    issuedAt,
    exp,
    onboardingCompleted,
  });

  return buildSessionResponse(token, {
    ...sessionUser,
    issuedAt,
    exp,
    onboardingCompleted,
    organizationRole: membership?.role ?? sessionUser.organizationRole,
  });
}

export async function createAuthSession(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { ensureUser, provisionUserAndOrganization } = await import(
    "../../organization/service"
  );

  if (normalizedEmail === "demo@agentos.ai") {
    await provisionUserAndOrganization(normalizedEmail);
  } else {
    await ensureUser(normalizedEmail);
  }

  const { prisma } = await import("../../db/client");
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: normalizedEmail },
  });

  const { ensureOnboarding, seedDemoOnboarding } = await import("../../onboarding/store");

  if (normalizedEmail === "demo@agentos.ai") {
    const session = await issueSessionForUserId(user.id);
    await seedDemoOnboarding(session.user.id, session.user.email, session.user.name);
    return issueSessionForUserId(user.id);
  }

  await ensureOnboarding({
    userId: user.id,
    email: user.email,
    name: user.name,
    completed: false,
  });

  return issueSessionForUserId(user.id);
}

export function registerEmail(email: string) {
  registeredEmails.add(email);
}

export function isEmailRegistered(email: string) {
  return registeredEmails.has(email);
}

export function revokeAuthToken(_token: string): void {
  // JWT sessions are stateless; client discard is sufficient for now.
}
