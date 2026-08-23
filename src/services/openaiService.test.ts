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
