import assert from "node:assert/strict";
import test from "node:test";

import { enforceRateLimit, type DurableRateLimiter } from "./rate-limit.ts";

test("rate limit enforcement delegates to an injected durable provider", async () => {
  const limiter: DurableRateLimiter = {
    async check(request) {
      assert.equal(request.key, "auth:test");
      return { allowed: false, remaining: 0, retryAfterSeconds: 30 };
    },
  };

  const result = await enforceRateLimit(limiter, {
    key: "auth:test",
    limit: 5,
    windowSeconds: 60,
  });

  assert.deepEqual(result, {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 30,
  });
});
