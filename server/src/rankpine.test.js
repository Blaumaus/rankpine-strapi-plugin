import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, it } from "node:test";

import createService from "./services/rankpine.js";
import { canonicalRequest, sha256 } from "./security.js";

function fakeStrapi() {
  const values = new Map();
  const nonces = new Set();
  const pairing = {
    id: 1,
    tokenHash: sha256("p".repeat(48)),
    contentTypeUid: "api::article.article",
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };
  const strapi = {
    contentTypes: {
      "api::article.article": {
        kind: "collectionType",
        collectionName: "articles",
        info: { singularName: "article", pluralName: "articles", displayName: "Article" },
        options: { draftAndPublish: true },
        pluginOptions: { i18n: { localized: false } },
        attributes: {
          title: { type: "string", required: true },
          slug: { type: "uid", required: true, unique: true },
          body: { type: "richtext", required: true },
          cover: { type: "media", multiple: false, allowedTypes: ["images"] },
          createdAt: { type: "datetime" },
        },
      },
    },
    config: {
      get(key) {
        if (key === "info.strapi") return "5.51.2";
        if (key === "plugin::rankpine.rankpineUrl") return "https://rankpine.com";
        return undefined;
      },
    },
    store() {
      return {
        async get({ key }) {
          return values.get(key);
        },
        async set({ key, value }) {
          values.set(key, value);
        },
      };
    },
    plugin(name) {
      if (name !== "i18n") throw new Error(`Unexpected plugin ${name}`);
      return {
        service(serviceName) {
          assert.equal(serviceName, "locales");
          return {
            async find() {
              return [{ code: "en", name: "English" }];
            },
            async setIsDefault(rows) {
              return rows.map((locale) => ({ ...locale, isDefault: locale.code === "en" }));
            },
          };
        },
      };
    },
    db: {
      query(uid) {
        if (uid === "plugin::rankpine.pairing") {
          return {
            async findOne({ where }) {
              return where.tokenHash === pairing.tokenHash ? { ...pairing } : null;
            },
            async update({ where, data }) {
              if (where.id !== pairing.id || pairing.consumedAt) return null;
              pairing.consumedAt = data.consumedAt;
              return { ...pairing };
            },
            async deleteMany() {},
            async create() {},
          };
        }
        if (uid === "plugin::rankpine.nonce") {
          return {
            async deleteMany() {},
            async create({ data }) {
              if (nonces.has(data.nonceHash)) throw new Error("unique violation");
              nonces.add(data.nonceHash);
              return data;
            },
          };
        }
        if (uid === "plugin::i18n.locale") {
          return {
            async findMany() {
              return [];
            },
          };
        }
        throw new Error(`Unexpected query ${uid}`);
      },
    },
    documents() {
      return {
        async findMany() {
          return [{ documentId: "existing-document" }];
        },
        async update(input) {
          values.set("lastDocumentWrite", input);
          return { documentId: input.documentId };
        },
        async create(input) {
          values.set("lastDocumentWrite", input);
          return { documentId: "created-document" };
        },
      };
    },
  };
  return { strapi, values };
}

describe("RankPine Strapi plugin service", () => {
  it("discovers system attributes as read-only", async () => {
    const { strapi } = fakeStrapi();
    const settings = await createService({ strapi }).settings();
    const createdAt = settings.contentTypes[0].attributes.find(
      (attribute) => attribute.name === "createdAt",
    );
    assert.equal(createdAt.writable, false);
    assert.deepEqual(settings.locales, [{ code: "en", name: "English", isDefault: true }]);
  });

  it("keeps the pairing code out of the RankPine URL", async () => {
    const { strapi, values } = fakeStrapi();
    values.set("settings", {
      publicUrl: "https://cms.example.com",
      selectedContentTypeUid: "api::article.article",
    });
    const handoff = await createService({ strapi }).createPairing();
    assert.equal(handoff.connectUrl, "https://rankpine.com/connect/strapi");
    assert.equal(new URL(handoff.connectUrl).search, "");
    assert.equal(handoff.siteUrl, "https://cms.example.com");
    assert.match(handoff.pairToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(handoff.connectUrl.includes(handoff.pairToken), false);
  });

  it("consumes a pairing once and stores only the public key", async () => {
    const { strapi, values } = fakeStrapi();
    const service = createService({ strapi });
    const keys = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const result = await service.pairing("p".repeat(48), true, {
      keyId: "rankpine-key-id-123",
      publicKeyPem: keys.publicKey,
    });
    assert.equal(result.connection.connected, true);
    const stored = values.get("connection");
    assert.equal(stored.publicKeyPem, keys.publicKey);
    assert.equal("privateKeyPem" in stored, false);
    await assert.rejects(
      service.pairing("p".repeat(48), true, {
        keyId: "rankpine-key-id-123",
        publicKeyPem: keys.publicKey,
      }),
      /already used/,
    );
  });

  it("claims a signed request nonce once and rejects replay", async () => {
    const { strapi, values } = fakeStrapi();
    const service = createService({ strapi });
    const keys = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    values.set("connection", {
      keyId: "rankpine-key-id-123",
      publicKeyPem: keys.publicKey,
      contentTypeUid: "api::article.article",
      pairedAt: new Date().toISOString(),
    });
    const body = JSON.stringify({ data: { title: "Article" } });
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const nonce = "single-use-request-nonce";
    const signature = sign(
      null,
      Buffer.from(canonicalRequest("POST", "/api/rankpine/publish", timestamp, nonce, body)),
      keys.privateKey,
    ).toString("base64url");
    const ctx = {
      method: "POST",
      path: "/api/rankpine/publish",
      request: { body: { data: { title: "Article" } } },
      headers: {
        "x-rankpine-key-id": "rankpine-key-id-123",
        "x-rankpine-timestamp": timestamp,
        "x-rankpine-nonce": nonce,
        "x-rankpine-signature": signature,
      },
    };
    await service.authenticate(ctx);
    await assert.rejects(service.authenticate(ctx), /already used/);
  });

  it("filters mapped data, attaches media, and updates a draft by documentId", async () => {
    const { strapi, values } = fakeStrapi();
    const keys = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    values.set("connection", {
      keyId: "rankpine-key-id-123",
      publicKeyPem: keys.publicKey,
      contentTypeUid: "api::article.article",
      pairedAt: new Date().toISOString(),
    });
    const service = createService({
      strapi,
      uploadImage: async (_strapi, image, articleId) => {
        assert.equal(image.url, "https://cdn.example.com/hero.webp");
        assert.equal(articleId, "article-1");
        return 77;
      },
    });
    const payload = {
      contentTypeUid: "api::article.article",
      contentType: { uid: "api::article.article" },
      fieldMappings: {
        title: "title",
        slug: "slug",
        body: "body",
        featuredMedia: "cover",
        booleans: {},
        enums: {},
        relations: {},
      },
      data: { title: "Article", slug: "article", body: "# Article" },
      identity: { field: "slug", value: "article" },
      existingDocumentId: "existing-document",
      publishMode: "draft",
      featuredImage: { url: "https://cdn.example.com/hero.webp", alt: "Cover" },
      articleId: "article-1",
    };
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const nonce = "publish-request-nonce-123";
    const signature = sign(
      null,
      Buffer.from(canonicalRequest("POST", "/api/rankpine/publish", timestamp, nonce, body)),
      keys.privateKey,
    ).toString("base64url");
    const result = await service.publish({
      method: "POST",
      path: "/api/rankpine/publish",
      request: { body: payload },
      headers: {
        "x-rankpine-key-id": "rankpine-key-id-123",
        "x-rankpine-timestamp": timestamp,
        "x-rankpine-nonce": nonce,
        "x-rankpine-signature": signature,
      },
    });
    assert.deepEqual(result, { documentId: "existing-document", live: false });
    assert.deepEqual(values.get("lastDocumentWrite"), {
      documentId: "existing-document",
      data: { title: "Article", slug: "article", body: "# Article", cover: 77 },
      status: "draft",
    });
  });
});
