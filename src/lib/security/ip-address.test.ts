import assert from "node:assert/strict";
import test from "node:test";

import { normalizeIpAddress } from "./ip-address-core.ts";

test("manual IP normalization accepts addresses but not networks or arbitrary text", () => {
  assert.equal(normalizeIpAddress(" 198.51.100.7 "), "198.51.100.7");
  assert.equal(normalizeIpAddress("2001:db8::7"), "2001:db8::7");
  assert.equal(normalizeIpAddress("2001:DB8::7"), "2001:db8::7");
  assert.equal(normalizeIpAddress("::ffff:127.0.0.1"), "::ffff:127.0.0.1");
  assert.equal(normalizeIpAddress("fe80::1%eth0"), null);
  assert.equal(normalizeIpAddress("198.51.100.0/24"), null);
  assert.equal(normalizeIpAddress("2001:db8::7 trailing"), null);
  assert.equal(normalizeIpAddress("not-an-ip"), null);
});
