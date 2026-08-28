import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, it } from "node:test";

import {
  canonicalRequest,
  createPairingToken,
  isPrivateAddress,
  sha256,
  validateEd25519PublicKey,
  verifySignedRequest,
} from "./security.js";

describe("RankPine Strapi plugin security", () => {
  it("creates high-entropy URL-safe pairing tokens and stores a stable hash", () => {
    const token = createPairingToken();
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(sha256(token).length, 64);
  });

  it("accepts a fresh Ed25519 signature and binds method, path, body, and nonce", () => {
    const keys = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const timestamp = "1787925600";
    const nonce = "single-use-nonce-123";
    const body = JSON.stringify({ data: { title: "Article" } });
    const signature = sign(
      null,
      Buffer.from(canonicalRequest("POST", "/api/rankpine/publish", timestamp, nonce, body)),
      keys.privateKey,
    ).toString("base64url");
    const result = verifySignedRequest({
      method: "POST",
      path: "/api/rankpine/publish",
      body,
      publicKeyPem: keys.publicKey,
      expectedKeyId: "rankpine-key-id-123",
      headers: {
        "x-rankpine-key-id": "rankpine-key-id-123",
        "x-rankpine-timestamp": timestamp,
        "x-rankpine-nonce": nonce,
        "x-rankpine-signature": signature,
      },
      now: new Date(Number(timestamp) * 1_000),
    });
    assert.deepEqual(result, { ok: true, nonce });
    assert.equal(validateEd25519PublicKey(keys.publicKey), true);
  });

  it("rejects stale, tampered, and unknown-key requests", () => {
    const keys = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const headers = {
      "x-rankpine-key-id": "rankpine-key-id-123",
      "x-rankpine-timestamp": "1787920000",
      "x-rankpine-nonce": "single-use-nonce-123",
      "x-rankpine-signature": "x".repeat(86),
    };
    assert.equal(
      verifySignedRequest({
        method: "POST",
        path: "/api/rankpine/publish",
        body: "{}",
        publicKeyPem: keys.publicKey,
        expectedKeyId: "rankpine-key-id-123",
        headers,
        now: new Date("2026-08-28T12:00:00.000Z"),
      }).reason,
      "stale",
    );
    assert.equal(
      verifySignedRequest({
        method: "POST",
        path: "/api/rankpine/publish",
        body: "{}",
        publicKeyPem: keys.publicKey,
        expectedKeyId: "another-key-id-123",
        headers,
        now: new Date("2026-08-28T12:00:00.000Z"),
      }).reason,
      "unknown_key",
    );
  });

  it("blocks loopback, private, link-local, CGNAT, and metadata ranges", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.4",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "fd00::1",
    ]) {
      assert.equal(isPrivateAddress(address), true, address);
    }
    assert.equal(isPrivateAddress("8.8.8.8"), false);
    assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
  });
});
