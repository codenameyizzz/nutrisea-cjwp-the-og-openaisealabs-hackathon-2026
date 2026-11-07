import assert from "node:assert/strict";
import test from "node:test";
import { isSameAppOrigin } from "./request-origin";

test("localhost browser origin matches Host when Next uses an internal bind address", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) {
    assert.equal(isSameAppOrigin(new Request("http://0.0.0.0:3000/api/auth/bootstrap", {
      headers: { host, origin: `http://${host}`, "sec-fetch-site": "same-origin" },
    })), true);
  }
});

test("different origins and cross-site bootstrap requests remain rejected", () => {
  for (const origin of ["https://evil.example", "http://localhost:4000", "null", "invalid", "https://localhost:3000"]) {
    assert.equal(isSameAppOrigin(new Request("http://0.0.0.0:3000/api/auth/bootstrap", {
      headers: { host: "localhost:3000", origin },
    })), false, origin);
  }
  assert.equal(isSameAppOrigin(new Request("http://localhost:3000/api/auth/bootstrap", {
    headers: { origin: "http://localhost:3000", "sec-fetch-site": "cross-site" },
  })), false);
});
