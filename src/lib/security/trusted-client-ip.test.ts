import assert from "node:assert/strict";
import test from "node:test";

import { trustedClientIpFromVercel, trustedRateLimitIpBucketFromVercel } from "./trusted-client-ip-core.ts";

function requestHeaders(values: Record<string, string>): Pick<Headers, "get"> {
  const headers = new Headers(values);
  return { get: headers.get.bind(headers) };
}

const production = { vercel: "1", vercelEnvironment: "production" };

test("trusted IP accepts only Vercel-controlled provenance in production", () => {
  const headers = requestHeaders({
    "x-forwarded-for": "203.0.113.1",
    forwarded: "for=203.0.113.2",
    "x-real-ip": "203.0.113.3",
    "x-vercel-forwarded-for": "198.51.100.7",
  });
  assert.equal(trustedClientIpFromVercel(headers, production), "198.51.100.7");
  assert.equal(trustedClientIpFromVercel(headers, { vercel: "1", vercelEnvironment: "preview" }), null);
  assert.equal(trustedClientIpFromVercel(headers, {}), null);
});

test("trusted IP fails safely when controlled provenance is absent or ambiguous", () => {
  assert.equal(trustedClientIpFromVercel(requestHeaders({ "x-forwarded-for": "198.51.100.7" }), production), null);
  assert.equal(trustedClientIpFromVercel(requestHeaders({ "x-vercel-forwarded-for": "198.51.100.7, 203.0.113.2" }), production), null);
  assert.equal(trustedClientIpFromVercel(requestHeaders({ "x-vercel-forwarded-for": "invalid" }), production), null);
});

test("trusted buckets normalize mapped IPv4 and aggregate only IPv6", () => {
  assert.equal(trustedRateLimitIpBucketFromVercel(requestHeaders({ "x-vercel-forwarded-for": "::ffff:192.0.2.1" }), production), "192.0.2.1");
  assert.equal(trustedRateLimitIpBucketFromVercel(requestHeaders({ "x-vercel-forwarded-for": "2001:db8:12:34::9" }), production), "2001:db8:12:34::/64");
});
