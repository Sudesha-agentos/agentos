import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { pgPoolConfig } from "./pgPool";

declare global {
  // Reuse Prisma client across hot reloads in dev to avoid connection storms.
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for pipeline features");
  }

  const pool = new Pool(pgPoolConfig(connectionString));
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "error", "warn"],
  });
}

export function getPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  return global.__prisma;
}

function requirePrisma(): PrismaClient {
  const client = getPrisma();
  if (!client) {
    throw new Error("DATABASE_URL is required for pipeline features");
  }
  return client;
}

/** Lazy Prisma client; pipeline routes need DATABASE_URL. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = requirePrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
