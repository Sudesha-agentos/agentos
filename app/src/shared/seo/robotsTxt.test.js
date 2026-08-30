import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../");
const robots = readFileSync(resolve(root, "public/robots.txt"), "utf8");
const sitemap = readFileSync(resolve(root, "public/sitemap.xml"), "utf8");
const vercel = readFileSync(resolve(root, "vercel.json"), "utf8");

describe("robots.txt crawl rules", () => {
  it("allows marketing pages and points at the sitemap", () => {
    expect(robots).toMatch(/User-agent:\s*\*/);
    expect(robots).toMatch(/Allow:\s*\/$/m);
    expect(robots).toContain("Allow: /roi");
    expect(robots).toContain("Allow: /privacy");
    expect(robots).toContain("Sitemap: https://agentox.io/sitemap.xml");
  });

  it("blocks auth, API, and workspace apps", () => {
    for (const path of [
      "/login",
      "/forgot-password",
      "/reset-password",
      "/onboarding",
      "/auth/",
      "/app",
      "/api/",
      "/*/pipelines",
      "/*/settings",
      "/*/board",
    ]) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
  });

  it("lists only public URLs in the sitemap", () => {
    expect(sitemap).toContain("https://agentox.io/</loc>");
    expect(sitemap).toContain("https://agentox.io/roi");
    expect(sitemap).not.toContain("/login");
    expect(sitemap).not.toContain("/onboarding");
  });

  it("does not rewrite robots.txt or sitemap.xml to the SPA", () => {
    expect(vercel).toContain("robots");
    expect(vercel).toContain("sitemap");
  });
});
