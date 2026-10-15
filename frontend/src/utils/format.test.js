import test from "node:test";
import assert from "node:assert/strict";
import { countLabel } from "./format.js";

test("countLabel uses the singular only for exactly one", () => {
  assert.equal(countLabel(1, "exercise"), "1 exercise");
  assert.equal(countLabel(0, "exercise"), "0 exercises");
  assert.equal(countLabel(3, "set"), "3 sets");
  assert.equal(countLabel("1", "record"), "1 record");
  assert.equal(countLabel(2, "day", "days"), "2 days");
});
