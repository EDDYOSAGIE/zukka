import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSectorNewsSnapshot } from "./openaiService";

describe("buildSectorNewsSnapshot", () => {
  it("creates a sector-specific update with actionable signals", () => {
    const snapshot = buildSectorNewsSnapshot("fashion");

    assert.equal(snapshot.sector, "Fashion");
    assert.ok(snapshot.headlines.length >= 3);
    assert.ok(snapshot.headlines[0].title.toLowerCase().includes("fashion"));
    assert.ok(snapshot.insights.some((item) => item.toLowerCase().includes("demand")));
  });
});

describe("analyzeCustomerIntent", () => {
  it("detects Nigerian pidgin discount markers (abeg, discount, last price)", async () => {
    const { analyzeCustomerIntent } = await import("./openaiService");

    const result1 = await analyzeCustomerIntent(
      "Hello bro, abeg can you do 10% discount on the vintage linen shirt? Will pay now.",
      "Vintage Linen Shirt",
      22000
    );
    assert.equal(result1.detectsBargain, true);

    const result2 = await analyzeCustomerIntent(
      "How much last for the Ankara Tote Bag?",
      "Ankara Tote Bag",
      15000
    );
    assert.equal(result2.detectsBargain, true);
  });

  it("does not detect bargain on standard product or shipping inquiries", async () => {
    const { analyzeCustomerIntent } = await import("./openaiService");

    const result = await analyzeCustomerIntent(
      "Can you deliver to Lekki Phase 1 tomorrow morning?",
      "Beaded Slides",
      9500
    );
    assert.equal(result.detectsBargain, false);
  });
});
