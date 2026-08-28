"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const node_crypto = require("node:crypto");
const node_net = require("node:net");
const promises$1 = require("node:dns/promises");
const promises = require("node:fs/promises");
const node_os = require("node:os");
const node_path = require("node:path");
const undici = require("undici");
const node_module = require("node:module");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
const actions = [
  {
    section: "settings",
    displayName: "Read RankPine settings",
    uid: "settings.read",
    pluginName: "rankpine"
  },
  {
    section: "settings",
    displayName: "Update RankPine settings and connection",
    uid: "settings.update",
    pluginName: "rankpine"
  }
];
const bootstrap = async ({ strapi }) => {
  await strapi.admin.services.permission.actionProvider.registerMany(actions);
};
const config = {
  default: {
    rankpineUrl: "https://rankpine.com",
    publicUrl: ""
  },
  validator(config2) {
    if (config2.rankpineUrl && !String(config2.rankpineUrl).startsWith("https://")) {
      throw new Error("rankpineUrl must use HTTPS.");
    }
    if (config2.publicUrl && !String(config2.publicUrl).startsWith("https://")) {
      throw new Error("publicUrl must use HTTPS.");
    }
  }
};
const kind$1 = "collectionType";
const collectionName$1 = "rankpine_nonces";
const info$1 = { "singularName": "nonce", "pluralName": "nonces", "displayName": "RankPine nonce" };
const options$1 = { "draftAndPublish": false };
const pluginOptions$1 = { "content-manager": { "visible": false }, "content-type-builder": { "visible": false } };
const attributes$1 = { "nonceHash": { "type": "string", "required": true, "unique": true, "private": true }, "expiresAt": { "type": "datetime", "required": true } };
const schema$1 = {
  kind: kind$1,
  collectionName: collectionName$1,
  info: info$1,
  options: options$1,
  pluginOptions: pluginOptions$1,
  attributes: attributes$1
};
const nonce = { schema: schema$1 };
const kind = "collectionType";
const collectionName = "rankpine_pairings";
const info = { "singularName": "pairing", "pluralName": "pairings", "displayName": "RankPine pairing" };
const options = { "draftAndPublish": false };
const pluginOptions = { "content-manager": { "visible": false }, "content-type-builder": { "visible": false } };
const attributes = { "tokenHash": { "type": "string", "required": true, "unique": true, "private": true }, "contentTypeUid": { "type": "string", "required": true }, "expiresAt": { "type": "datetime", "required": true }, "consumedAt": { "type": "datetime" } };
const schema = {
  kind,
  collectionName,
  info,
  options,
  pluginOptions,
  attributes
};
const pairing = { schema };
const contentTypes = { nonce, pairing };
const SIGNATURE_PREFIX = "rankpine-strapi-v1";
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;
const PAIRING_MAX_AGE_MS = 10 * 60 * 1e3;
function sha256(value) {
  return node_crypto.createHash("sha256").update(value).digest("hex");
}
function createPairingToken() {
  return node_crypto.randomBytes(32).toString("base64url");
}
function canonicalRequest(method, path, timestamp, nonce2, body) {
  const digest = sha256(body ?? "");
  return [SIGNATURE_PREFIX, method.toUpperCase(), path, timestamp, nonce2, digest].join("\n");
}
function validateEd25519PublicKey(value) {
  if (typeof value !== "string" || value.length > 8192) return false;
  try {
    return node_crypto.createPublicKey(value).asymmetricKeyType === "ed25519";
  } catch {
    return false;
  }
}
function verifySignedRequest({
  method,
  path,
  body,
  publicKeyPem,
  expectedKeyId,
  headers,
  now = /* @__PURE__ */ new Date()
}) {
  const keyId = header(headers, "x-rankpine-key-id");
  const timestamp = header(headers, "x-rankpine-timestamp");
  const nonce2 = header(headers, "x-rankpine-nonce");
  const signature = header(headers, "x-rankpine-signature");
  if (!keyId || !safeEqual(keyId, expectedKeyId)) return { ok: false, reason: "unknown_key" };
  if (!/^\d{10,13}$/.test(timestamp ?? "")) return { ok: false, reason: "invalid_timestamp" };
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds)) return { ok: false, reason: "invalid_timestamp" };
  if (Math.abs(Math.floor(now.getTime() / 1e3) - seconds) > SIGNATURE_MAX_AGE_SECONDS) {
    return { ok: false, reason: "stale" };
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce2 ?? "")) return { ok: false, reason: "invalid_nonce" };
  if (!/^[A-Za-z0-9_-]{64,128}$/.test(signature ?? "")) {
    return { ok: false, reason: "invalid_signature" };
  }
  try {
    const canonical = canonicalRequest(method, path, timestamp, nonce2, body);
    const valid = node_crypto.verify(
      null,
      Buffer.from(canonical),
      publicKeyPem,
      Buffer.from(signature, "base64url")
    );
    return valid ? { ok: true, nonce: nonce2 } : { ok: false, reason: "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
}
function header(headers, name) {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : typeof value === "string" ? value : void 0;
}
function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && node_crypto.timingSafeEqual(a, b);
}
function isPrivateAddress(address) {
  const normalized = address.replace(/^::ffff:/, "").toLowerCase();
  if (!node_net.isIP(normalized)) return true;
  if (normalized.includes(":")) {
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized);
  }
  const parts = normalized.split(".").map(Number);
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a >= 224;
}
function redactError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/(authorization|token|private[-_ ]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]").replace(/[\r\n\t]+/g, " ").slice(0, 300);
}
function pairingToken(ctx) {
  const header2 = ctx.get("authorization");
  const match = /^Pairing ([A-Za-z0-9_-]{32,256})$/.exec(header2 ?? "");
  return match?.[1];
}
const rankpine$1 = ({ strapi }) => {
  const service = () => strapi.plugin("rankpine").service("rankpine");
  return {
    async settings(ctx) {
      ctx.body = await service().settings();
    },
    async saveSettings(ctx) {
      try {
        ctx.body = await service().saveSettings(ctx.request.body ?? {});
      } catch (error) {
        ctx.badRequest(redactError(error));
      }
    },
    async createPairing(ctx) {
      try {
        ctx.body = await service().createPairing();
      } catch (error) {
        ctx.badRequest(redactError(error));
      }
    },
    async disconnectAdmin(ctx) {
      ctx.body = await service().disconnect();
    },
    async inspectPairing(ctx) {
      const token = pairingToken(ctx);
      if (!token) return ctx.unauthorized("Pairing is unavailable.");
      try {
        ctx.body = await service().pairing(token, false);
      } catch {
        ctx.unauthorized("Pairing is unavailable.");
      }
    },
    async pair(ctx) {
      const token = pairingToken(ctx);
      if (!token) return ctx.unauthorized("Pairing is unavailable.");
      try {
        ctx.body = await service().pairing(token, true, ctx.request.body ?? {});
      } catch {
        ctx.unauthorized("Pairing is unavailable.");
      }
    },
    async discovery(ctx) {
      try {
        ctx.body = await service().discovery(ctx);
      } catch {
        ctx.unauthorized("Signed RankPine request required.");
      }
    },
    async publish(ctx) {
      try {
        ctx.body = await service().publish(ctx);
      } catch (error) {
        const message = redactError(error);
        if (/signature|connected|already used/i.test(message)) {
          return ctx.unauthorized("Signed RankPine request required.");
        }
        await service().recordError(error);
        ctx.badRequest(message);
      }
    },
    async disconnect(ctx) {
      try {
        ctx.body = await service().disconnect(ctx);
      } catch {
        ctx.unauthorized("Signed RankPine request required.");
      }
    }
  };
};
const controllers = { rankpine: rankpine$1 };
const destroy = () => {
};
const register = () => {
};
const readScope = "plugin::rankpine.settings.read";
const writeScope = "plugin::rankpine.settings.update";
const routes = {
  admin: {
    type: "admin",
    routes: [
      {
        method: "GET",
        path: "/settings",
        handler: "rankpine.settings",
        config: {
          policies: ["admin::isAuthenticatedAdmin"],
          auth: { scope: [readScope] }
        }
      },
      {
        method: "PUT",
        path: "/settings",
        handler: "rankpine.saveSettings",
        config: {
          policies: ["admin::isAuthenticatedAdmin"],
          auth: { scope: [writeScope] }
        }
      },
      {
        method: "POST",
        path: "/pairing",
        handler: "rankpine.createPairing",
        config: {
          policies: ["admin::isAuthenticatedAdmin"],
          auth: { scope: [writeScope] }
        }
      },
      {
        method: "DELETE",
        path: "/connection",
        handler: "rankpine.disconnectAdmin",
        config: {
          policies: ["admin::isAuthenticatedAdmin"],
          auth: { scope: [writeScope] }
        }
      }
    ]
  },
  "content-api": {
    type: "content-api",
    routes: [
      {
        method: "GET",
        path: "/pair",
        handler: "rankpine.inspectPairing",
        config: { auth: false, policies: [] }
      },
      {
        method: "POST",
        path: "/pair",
        handler: "rankpine.pair",
        config: { auth: false, policies: [] }
      },
      {
        method: "GET",
        path: "/discovery",
        handler: "rankpine.discovery",
        config: { auth: false, policies: [] }
      },
      {
        method: "POST",
        path: "/publish",
        handler: "rankpine.publish",
        config: { auth: false, policies: [] }
      },
      {
        method: "POST",
        path: "/disconnect",
        handler: "rankpine.disconnect",
        config: { auth: false, policies: [] }
      }
    ]
  }
};
const MAX_BYTES = 1e7;
const MAX_REDIRECTS = 3;
async function target(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Featured media must use a public HTTPS URL.");
  }
  const addresses = await promises$1.lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address.address))) {
    throw new Error("Featured media resolved to a private or unsafe address.");
  }
  return { url, addresses };
}
function pinnedLookup(addresses) {
  return (_hostname, options2, callback) => {
    if (options2?.all) {
      callback(
        null,
        addresses.map(({ address, family }) => ({ address, family }))
      );
      return;
    }
    const preferred = addresses.find((address) => address.family === options2?.family) ?? addresses[0];
    callback(null, preferred.address, preferred.family);
  };
}
async function readCapped(response) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {
      });
      throw new Error("Featured media exceeds the 10 MB limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
function detectImage(body) {
  if (body.length >= 3 && body[0] === 255 && body[1] === 216 && body[2] === 255) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mime: "image/png", extension: "png" };
  }
  if (body.length >= 12 && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  if (body.length >= 6 && /^GIF8[79]a$/.test(body.toString("ascii", 0, 6))) {
    return { mime: "image/gif", extension: "gif" };
  }
  throw new Error("Featured media must be a JPEG, PNG, WebP, or GIF. SVG is not accepted.");
}
async function downloadPublicImage(input) {
  let current = input;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const { url, addresses } = await target(current);
    const dispatcher = new undici.Agent({ connect: { lookup: pinnedLookup(addresses) } });
    try {
      const response = await undici.fetch(url, {
        method: "GET",
        redirect: "manual",
        dispatcher,
        signal: AbortSignal.timeout(15e3),
        headers: { "user-agent": "RankPine-Strapi-Plugin/1.0" }
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => {
        });
        if (!location) throw new Error("Featured media redirect had no destination.");
        current = new URL(location, url).toString();
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        await response.body?.cancel().catch(() => {
        });
        throw new Error(`Featured media returned HTTP ${response.status}.`);
      }
      const body = await readCapped(response);
      return { body, ...detectImage(body) };
    } finally {
      await dispatcher.close().catch(() => {
      });
    }
  }
  throw new Error("Featured media redirected too many times.");
}
async function uploadFeaturedImage(strapi, image, articleId) {
  if (!image?.url || typeof image.url !== "string") return void 0;
  const identity = `rankpine-${sha256(String(articleId || image.url)).slice(0, 24)}`;
  const existing = await strapi.db.query("plugin::upload.file").findMany({
    where: { name: identity },
    limit: 2
  });
  if (existing.length > 1) throw new Error("More than one RankPine media item has this identity.");
  if (existing[0]?.id !== void 0) return existing[0].id;
  const downloaded = await downloadPublicImage(image.url);
  const directory = await promises.mkdtemp(node_path.join(node_os.tmpdir(), "rankpine-strapi-"));
  const filename = `${identity}.${downloaded.extension}`;
  const path = node_path.join(directory, filename);
  try {
    await promises.writeFile(path, downloaded.body, { flag: "wx", mode: 384 });
    const uploaded = await strapi.plugin("upload").service("upload").upload({
      data: {
        fileInfo: {
          name: identity,
          alternativeText: typeof image.alt === "string" ? image.alt.replace(/[\r\n\t]+/g, " ").slice(0, 500) : ""
        }
      },
      files: {
        path,
        name: filename,
        type: downloaded.mime,
        size: downloaded.body.length
      }
    });
    const id = uploaded?.[0]?.id;
    if (id === void 0) throw new Error("Strapi Upload did not return a media ID.");
    return id;
  } catch (error) {
    throw new Error(`Featured media upload failed: ${redactError(error)}`);
  } finally {
    await promises.rm(directory, { recursive: true, force: true });
  }
}
const PAIRING_UID = "plugin::rankpine.pairing";
const NONCE_UID = "plugin::rankpine.nonce";
const require$1 = node_module.createRequire(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("index.js", document.baseURI).href);
const SYSTEM_FIELDS = /* @__PURE__ */ new Set([
  "id",
  "documentId",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "createdBy",
  "updatedBy",
  "locale",
  "localizations"
]);
const MAPPABLE_FIELD_TYPES = /* @__PURE__ */ new Set([
  "string",
  "text",
  "richtext",
  "blocks",
  "uid",
  "media",
  "date",
  "datetime",
  "timestamp",
  "boolean",
  "enumeration",
  "relation"
]);
function attributeDiscovery(name, attribute) {
  return {
    name,
    type: attribute.type,
    required: attribute.required === true,
    private: attribute.private === true,
    localized: attribute.pluginOptions?.i18n?.localized === true,
    unique: attribute.unique === true,
    writable: attribute.writable !== false && !SYSTEM_FIELDS.has(name),
    ...typeof attribute.multiple === "boolean" ? { multiple: attribute.multiple } : {},
    ...Array.isArray(attribute.allowedTypes) ? { allowedTypes: attribute.allowedTypes } : {},
    ...Array.isArray(attribute.enum) ? { enumValues: attribute.enum } : {},
    ...typeof attribute.relation === "string" ? { relation: attribute.relation } : {},
    ...typeof attribute.target === "string" ? { target: attribute.target } : {},
    ...typeof attribute.component === "string" ? { component: attribute.component } : {},
    ...Array.isArray(attribute.components) ? { components: attribute.components } : {},
    ...typeof attribute.minLength === "number" ? { minLength: attribute.minLength } : {},
    ...typeof attribute.maxLength === "number" ? { maxLength: attribute.maxLength } : {}
  };
}
function contentTypeDiscovery(uid, contentType) {
  return {
    uid,
    singularName: contentType.info.singularName,
    pluralName: contentType.info.pluralName,
    displayName: contentType.info.displayName,
    kind: "collectionType",
    collectionName: contentType.collectionName,
    draftAndPublish: contentType.options?.draftAndPublish === true,
    localized: contentType.pluginOptions?.i18n?.localized === true,
    attributes: Object.entries(contentType.attributes ?? {}).map(
      ([name, attribute]) => attributeDiscovery(name, attribute)
    )
  };
}
function pluginStore(strapi) {
  return strapi.store({ type: "plugin", name: "rankpine" });
}
function version(strapi) {
  const configured = [
    strapi.config.get("info.strapiVersion"),
    strapi.config.get("info.strapi")
  ].find((value) => typeof value === "string" && /^\d+(?:\.|$)/.test(value));
  if (configured) return configured;
  try {
    return String(require$1("@strapi/strapi/package.json").version);
  } catch {
    return "unknown";
  }
}
function ensureHttps(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Use the public HTTPS URL of this Strapi server.");
  }
  url.search = "";
  url.hash = "";
  return url.href.replace(/\/+$/, "");
}
function publicUrl(strapi, stored) {
  const configured = stored?.publicUrl || strapi.config.get("plugin::rankpine.publicUrl");
  if (!configured) throw new Error("Set this Strapi server's public HTTPS URL before pairing.");
  return ensureHttps(configured);
}
function rankpineUrl(strapi) {
  return ensureHttps(
    String(strapi.config.get("plugin::rankpine.rankpineUrl") ?? "https://rankpine.com")
  );
}
function selectedContentType(strapi, uid) {
  const contentType = strapi.contentTypes[uid];
  if (!uid?.startsWith("api::") || !contentType || contentType.kind !== "collectionType") {
    throw new Error("Choose a user collection type exposed by Strapi's Content API.");
  }
  return contentType;
}
async function locales(strapi) {
  try {
    const service = strapi.plugin("i18n").service("locales");
    const rows = await service.setIsDefault(await service.find());
    return rows.map((locale) => ({
      code: locale.code,
      name: locale.name,
      isDefault: locale.isDefault === true
    })).sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return [];
  }
}
function connectionView(connection) {
  if (!connection?.keyId) return { connected: false };
  return {
    connected: true,
    keyId: `${connection.keyId.slice(0, 8)}…`,
    contentTypeUid: connection.contentTypeUid,
    pairedAt: connection.pairedAt
  };
}
function liveAttribute(contentType, name) {
  return name ? contentType.attributes?.[name] : void 0;
}
function expectField(contentType, name, allowed, role) {
  const attribute = liveAttribute(contentType, name);
  if (!attribute || attribute.private || attribute.writable === false || SYSTEM_FIELDS.has(name)) {
    throw new Error(`${role} is mapped to a missing, private, or read-only field (${name}).`);
  }
  if (!allowed.includes(attribute.type)) {
    throw new Error(`${role} field ${name} is ${attribute.type}; expected ${allowed.join(", ")}.`);
  }
  return attribute;
}
function validatePayload(contentType, payload) {
  const mappings = payload.fieldMappings;
  const data = payload.data;
  if (!mappings || typeof mappings !== "object" || !data || typeof data !== "object") {
    throw new Error("RankPine sent an invalid field mapping payload.");
  }
  expectField(contentType, mappings.title, ["string", "text"], "Title");
  expectField(contentType, mappings.body, ["richtext", "blocks", "text", "string"], "Body");
  expectField(contentType, mappings.slug, ["uid", "string"], "Slug");
  if (mappings.rankpineId) {
    expectField(contentType, mappings.rankpineId, ["string", "uid"], "RankPine article ID");
  }
  for (const [name, allowed, role] of [
    [mappings.excerpt, ["string", "text", "richtext"], "Excerpt"],
    [mappings.seoTitle, ["string", "text"], "SEO title"],
    [mappings.seoDescription, ["string", "text"], "SEO description"],
    [mappings.canonicalUrl, ["string", "text"], "Canonical URL"],
    [mappings.date, ["date", "datetime", "timestamp"], "Article date"]
  ]) {
    if (name) expectField(contentType, name, allowed, role);
  }
  if (mappings.featuredMedia) {
    const media = expectField(contentType, mappings.featuredMedia, ["media"], "Featured media");
    if (media.multiple || media.allowedTypes && !media.allowedTypes.includes("images")) {
      throw new Error("Featured media must be a single image field.");
    }
  }
  for (const [name, value] of Object.entries(mappings.booleans ?? {})) {
    expectField(contentType, name, ["boolean"], `Boolean field ${name}`);
    if (typeof value !== "boolean") throw new Error(`${name} requires an explicit boolean value.`);
  }
  for (const [name, value] of Object.entries(mappings.enums ?? {})) {
    const attribute = expectField(contentType, name, ["enumeration"], `Enum field ${name}`);
    if (!attribute.enum?.includes(value)) throw new Error(`${value} is not allowed for ${name}.`);
  }
  for (const [name, documentIds] of Object.entries(mappings.relations ?? {})) {
    const attribute = expectField(contentType, name, ["relation"], `Relation field ${name}`);
    if (!Array.isArray(documentIds) || documentIds.some((id) => typeof id !== "string")) {
      throw new Error(`${name} requires Strapi document IDs.`);
    }
    if (attribute.required && documentIds.length === 0) {
      throw new Error(`Required relation ${name} needs at least one documentId.`);
    }
    if (documentIds.length > 1 && ["oneToOne", "manyToOne", "morphToOne"].includes(attribute.relation)) {
      throw new Error(`${name} accepts only one documentId.`);
    }
  }
  const allowedFields = new Set(
    [
      mappings.title,
      mappings.body,
      mappings.slug,
      mappings.rankpineId,
      mappings.excerpt,
      mappings.seoTitle,
      mappings.seoDescription,
      mappings.canonicalUrl,
      mappings.date,
      ...Object.keys(mappings.booleans ?? {}),
      ...Object.keys(mappings.enums ?? {}),
      ...Object.keys(mappings.relations ?? {})
    ].filter(Boolean)
  );
  for (const name of Object.keys(data)) {
    if (!allowedFields.has(name)) throw new Error(`RankPine sent an unmapped field (${name}).`);
    const attribute = liveAttribute(contentType, name);
    if (attribute?.type === "component" || attribute?.type === "dynamiczone") {
      throw new Error(`Components and dynamic zones cannot be written by this plugin (${name}).`);
    }
  }
  for (const [name, attribute] of Object.entries(contentType.attributes ?? {})) {
    if (!attribute.required || attribute.private || attribute.writable === false) continue;
    if (name === mappings.featuredMedia && payload.featuredImage) continue;
    if (!(name in data)) {
      const kind2 = attribute.type === "component" || attribute.type === "dynamiczone";
      throw new Error(
        kind2 ? `Required ${attribute.type} field ${name} is unsupported.` : !MAPPABLE_FIELD_TYPES.has(attribute.type) ? `Required ${attribute.type} field ${name} is unsupported.` : `Required field ${name} has no explicit RankPine value.`
      );
    }
  }
  return { mappings, data: { ...data } };
}
async function findDocument(strapi, uid, identity, locale, draftAndPublish) {
  if (!identity?.field || typeof identity.value !== "string") return void 0;
  const matches = await strapi.documents(uid).findMany({
    filters: { [identity.field]: { $eq: identity.value } },
    ...locale ? { locale } : {},
    ...draftAndPublish ? { status: "draft" } : {},
    limit: 2
  });
  if (matches.length > 1) throw new Error(`More than one document matches ${identity.field}.`);
  return matches[0]?.documentId;
}
const rankpine = ({ strapi, uploadImage = uploadFeaturedImage }) => ({
  async settings() {
    const stored = await pluginStore(strapi).get({ key: "settings" }) ?? {};
    const connection = await pluginStore(strapi).get({ key: "connection" }) ?? null;
    const contentTypes2 = Object.entries(strapi.contentTypes).filter(
      ([uid, contentType]) => uid.startsWith("api::") && contentType.kind === "collectionType"
    ).map(([uid, contentType]) => contentTypeDiscovery(uid, contentType));
    return {
      strapiVersion: version(strapi),
      pluginVersion: "1.0.0",
      publicUrl: stored.publicUrl ?? "",
      selectedContentTypeUid: stored.selectedContentTypeUid ?? "",
      contentTypes: contentTypes2,
      locales: await locales(strapi),
      connection: connectionView(connection),
      diagnostics: {
        https: typeof stored.publicUrl === "string" && stored.publicUrl.startsWith("https://"),
        lastRequestAt: stored.lastRequestAt ?? null,
        lastError: stored.lastError ?? null,
        telemetry: false
      }
    };
  },
  async saveSettings(input) {
    const selected = selectedContentType(strapi, input.selectedContentTypeUid);
    const stored = await pluginStore(strapi).get({ key: "settings" }) ?? {};
    const next = {
      ...stored,
      publicUrl: ensureHttps(input.publicUrl),
      selectedContentTypeUid: Object.entries(strapi.contentTypes).find(
        ([, contentType]) => contentType === selected
      )?.[0]
    };
    await pluginStore(strapi).set({ key: "settings", value: next });
    return this.settings();
  },
  async createPairing() {
    const stored = await pluginStore(strapi).get({ key: "settings" }) ?? {};
    selectedContentType(strapi, stored.selectedContentTypeUid);
    const baseUrl = publicUrl(strapi, stored);
    const token = createPairingToken();
    const expiresAt = new Date(Date.now() + PAIRING_MAX_AGE_MS);
    await strapi.db.query(PAIRING_UID).deleteMany({ where: { expiresAt: { $lt: /* @__PURE__ */ new Date() } } });
    await strapi.db.query(PAIRING_UID).create({
      data: {
        tokenHash: sha256(token),
        contentTypeUid: stored.selectedContentTypeUid,
        expiresAt
      }
    });
    const url = new URL("/connect/strapi", rankpineUrl(strapi));
    return {
      connectUrl: url.toString(),
      siteUrl: baseUrl,
      pairToken: token,
      expiresAt: expiresAt.toISOString()
    };
  },
  async pairing(token, consume, key) {
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(token ?? "")) throw new Error("Invalid pairing code.");
    const row = await strapi.db.query(PAIRING_UID).findOne({ where: { tokenHash: sha256(token) } });
    if (!row || row.consumedAt || new Date(row.expiresAt).getTime() <= Date.now()) {
      throw new Error("Pairing code is missing, expired, or already used.");
    }
    const contentType = selectedContentType(strapi, row.contentTypeUid);
    if (consume) {
      if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key.keyId) || !validateEd25519PublicKey(key.publicKeyPem)) {
        throw new Error("RankPine sent an invalid signing key.");
      }
      const claimed = await strapi.db.query(PAIRING_UID).update({
        where: { id: row.id, consumedAt: { $null: true } },
        data: { consumedAt: /* @__PURE__ */ new Date() }
      });
      if (!claimed) throw new Error("Pairing code was already used.");
      await pluginStore(strapi).set({
        key: "connection",
        value: {
          keyId: key.keyId,
          publicKeyPem: key.publicKeyPem,
          contentTypeUid: row.contentTypeUid,
          pairedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
    return {
      strapiVersion: version(strapi),
      pluginVersion: "1.0.0",
      contentTypes: [contentTypeDiscovery(row.contentTypeUid, contentType)],
      locales: await locales(strapi),
      connection: consume ? {
        connected: true,
        keyId: key.keyId,
        contentTypeUid: row.contentTypeUid,
        pairedAt: (/* @__PURE__ */ new Date()).toISOString()
      } : { connected: false, contentTypeUid: row.contentTypeUid }
    };
  },
  async authenticate(ctx) {
    const connection = await pluginStore(strapi).get({ key: "connection" }) ?? null;
    if (!connection?.keyId || !connection.publicKeyPem)
      throw new Error("RankPine is not connected.");
    const body = ctx.method === "GET" ? void 0 : JSON.stringify(ctx.request.body ?? {});
    const result = verifySignedRequest({
      method: ctx.method,
      path: ctx.path,
      body,
      publicKeyPem: connection.publicKeyPem,
      expectedKeyId: connection.keyId,
      headers: ctx.headers
    });
    if (!result.ok) throw new Error("Request signature is invalid, stale, or already used.");
    await strapi.db.query(NONCE_UID).deleteMany({ where: { expiresAt: { $lt: /* @__PURE__ */ new Date() } } });
    try {
      await strapi.db.query(NONCE_UID).create({
        data: {
          nonceHash: sha256(result.nonce),
          expiresAt: new Date(Date.now() + PAIRING_MAX_AGE_MS)
        }
      });
    } catch {
      throw new Error("Request signature is invalid, stale, or already used.");
    }
    const stored = await pluginStore(strapi).get({ key: "settings" }) ?? {};
    await pluginStore(strapi).set({
      key: "settings",
      value: { ...stored, lastRequestAt: (/* @__PURE__ */ new Date()).toISOString(), lastError: null }
    });
    return connection;
  },
  async discovery(ctx) {
    const connection = await this.authenticate(ctx);
    const contentType = selectedContentType(strapi, connection.contentTypeUid);
    return {
      strapiVersion: version(strapi),
      pluginVersion: "1.0.0",
      contentTypes: [contentTypeDiscovery(connection.contentTypeUid, contentType)],
      locales: await locales(strapi),
      connection: connectionView(connection)
    };
  },
  async publish(ctx) {
    const connection = await this.authenticate(ctx);
    const payload = ctx.request.body;
    if (!payload || payload.contentTypeUid !== connection.contentTypeUid) {
      throw new Error("The signed request targets a different Strapi collection.");
    }
    const contentType = selectedContentType(strapi, connection.contentTypeUid);
    const liveSchema = contentTypeDiscovery(connection.contentTypeUid, contentType);
    if (payload.contentType?.uid !== liveSchema.uid)
      throw new Error("Strapi schema metadata is stale.");
    const { mappings, data } = validatePayload(contentType, payload);
    if (payload.publishMode === "draft" && contentType.options?.draftAndPublish !== true) {
      throw new Error("Draft mode requires Draft & Publish on this collection.");
    }
    const localized = contentType.pluginOptions?.i18n?.localized === true;
    const locale = localized ? payload.locale : void 0;
    if (localized && typeof locale !== "string") throw new Error("A locale is required.");
    if (locale) {
      const available = await locales(strapi);
      if (!available.some((candidate) => candidate.code === locale)) {
        throw new Error(`Locale ${locale} is not enabled.`);
      }
    }
    if (mappings.featuredMedia && payload.featuredImage) {
      data[mappings.featuredMedia] = await uploadImage(
        strapi,
        payload.featuredImage,
        payload.articleId
      );
    }
    const existingDocumentId = typeof payload.existingDocumentId === "string" ? payload.existingDocumentId : await findDocument(
      strapi,
      connection.contentTypeUid,
      payload.identity,
      locale,
      contentType.options?.draftAndPublish === true
    );
    const documentApi = strapi.documents(connection.contentTypeUid);
    const status = contentType.options?.draftAndPublish ? payload.publishMode === "draft" ? "draft" : "published" : void 0;
    const result = existingDocumentId ? await documentApi.update({
      documentId: existingDocumentId,
      data,
      ...locale ? { locale } : {},
      ...status ? { status } : {}
    }) : await documentApi.create({
      data,
      ...locale ? { locale } : {},
      ...status ? { status } : {}
    });
    if (!result?.documentId) throw new Error("Strapi did not return a documentId.");
    return {
      documentId: result.documentId,
      ...typeof payload.publicUrl === "string" ? { url: ensureHttps(payload.publicUrl) } : {},
      live: !contentType.options?.draftAndPublish || payload.publishMode === "published"
    };
  },
  async disconnect(ctx) {
    if (ctx) await this.authenticate(ctx);
    await pluginStore(strapi).set({ key: "connection", value: null });
    await strapi.db.query(NONCE_UID).deleteMany({ where: {} });
    return { disconnected: true };
  },
  async recordError(error) {
    const stored = await pluginStore(strapi).get({ key: "settings" }) ?? {};
    await pluginStore(strapi).set({
      key: "settings",
      value: { ...stored, lastError: redactError(error) }
    });
  }
});
const services = { rankpine };
const index = {
  register,
  bootstrap,
  destroy,
  config,
  contentTypes,
  controllers,
  routes,
  services
};
exports.default = index;
