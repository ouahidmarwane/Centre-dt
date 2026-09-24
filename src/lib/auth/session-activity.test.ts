import assert from "node:assert/strict";
import test from "node:test";

import { encodeActivity, IDLE_TIMEOUT_MS, isSessionIdle } from "./session-activity.ts";

test("a session is idle after 30 minutes without activity, or without a valid marker", () => {
  const now = new Date("2026-09-24T15:00:00Z");
  assert.equal(isSessionIdle(encodeActivity(new Date(now.getTime() - 29 * 60_000)), now), false);
  assert.equal(isSessionIdle(encodeActivity(new Date(now.getTime() - IDLE_TIMEOUT_MS - 1)), now), true);
  assert.equal(isSessionIdle(undefined, now), true, "no marker: sign in again");
  assert.equal(isSessionIdle("abc", now), true, "malformed marker");
  assert.equal(isSessionIdle(encodeActivity(new Date(now.getTime() + 10 * 60_000)), now), true, "a marker from the future is rejected");
});
