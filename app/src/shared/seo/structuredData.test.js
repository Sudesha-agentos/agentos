import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const html = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../index.html"),
  "utf8"
);
const vercel = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../vercel.json"),
  "utf8"
);

function parseJsonLd() {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(match).toBeTruthy();
  return JSON.parse(match[1]);
}

describe("structured data", () => {
  it("is valid JSON-LD without unofficial Offer fields", () => {
    const data = parseJsonLd();
    expect(data["@context"]).toBe("https://schema.org");
    expect(html).not.toContain("billingIncrement");

    const graph = data["@graph"];
    expect(Array.isArray(graph)).toBe(true);

    const app = graph.find((node) => {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      return types.includes("SoftwareApplication");
    });
    expect(app.applicationCategory).toBe("DeveloperApplication");
    expect(app.offers.length).toBeGreaterThan(0);
    for (const offer of app.offers) {
      expect(offer["@type"]).toBe("Offer");
      expect(typeof offer.price).toBe("number");
      expect(offer.priceCurrency).toBe("USD");
      expect(offer.availability).toBe("https://schema.org/InStock");
      expect(offer.billingIncrement).toBeUndefined();
      expect(offer.priceSpecification?.["@type"]).toBe("UnitPriceSpecification");
    }
  });

  it("does not invent review ratings", () => {
    expect(html).not.toContain("aggregateRating");
  });
});

describe("HTTPS host alignment", () => {
  it("sends www and the legacy Vercel host to agentox.io", () => {
    expect(vercel).toContain("www.agentox.io");
    expect(vercel).toContain("https://agentox.io/");
    expect(vercel).toContain("agentos-blue.vercel.app");
    expect(vercel).toContain("Strict-Transport-Security");
  });
});
