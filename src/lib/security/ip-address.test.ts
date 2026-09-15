import assert from "node:assert/strict";
import test from "node:test";

import { normalizeIpAddress, rateLimitIpBucket } from "./ip-address-core.ts";

test("manual IP normalization accepts addresses but not networks or arbitrary text", () => {
  assert.equal(normalizeIpAddress(" 198.51.100.7 "), "198.51.100.7");
  assert.equal(normalizeIpAddress("2001:db8::7"), "2001:db8::7");
  assert.equal(normalizeIpAddress("2001:DB8::7"), "2001:db8::7");
  assert.equal(normalizeIpAddress("::ffff:127.0.0.1"), "127.0.0.1");
  assert.equal(normalizeIpAddress("2001:0DB8:0000:0000:0000:0000:0000:0007"), "2001:db8::7");
  assert.equal(normalizeIpAddress("fe80::1%eth0"), null);
  assert.equal(normalizeIpAddress("198.51.100.0/24"), null);
  assert.equal(normalizeIpAddress("2001:db8::7 trailing"), null);
  assert.equal(normalizeIpAddress("not-an-ip"), null);
});

test("rate-limit buckets preserve IPv4 and aggregate IPv6 at /64", () => {
  assert.equal(rateLimitIpBucket("198.51.100.7"), "198.51.100.7");
  assert.equal(rateLimitIpBucket("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(rateLimitIpBucket("2001:db8:12:34:abcd::9"), "2001:db8:12:34::/64");
  assert.equal(rateLimitIpBucket("not-an-ip"), null);
});
