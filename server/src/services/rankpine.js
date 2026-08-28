import {
  createPairingToken,
  PAIRING_MAX_AGE_MS,
  redactError,
  sha256,
  validateEd25519PublicKey,
  verifySignedRequest,
} from "../security.js";
import { uploadFeaturedImage } from "../media.js";
import { createRequire } from "node:module";

const PAIRING_UID = "plugin::rankpine.pairing";
const NONCE_UID = "plugin::rankpine.nonce";
const require = createRequire(import.meta.url);
const SYSTEM_FIELDS = new Set([
  "id",
  "documentId",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "createdBy",
  "updatedBy",
  "locale",
  "localizations",
]);
const MAPPABLE_FIELD_TYPES = new Set([
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
  "relation",
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
    ...(typeof attribute.multiple === "boolean" ? { multiple: attribute.multiple } : {}),
    ...(Array.isArray(attribute.allowedTypes) ? { allowedTypes: attribute.allowedTypes } : {}),
    ...(Array.isArray(attribute.enum) ? { enumValues: attribute.enum } : {}),
    ...(typeof attribute.relation === "string" ? { relation: attribute.relation } : {}),
    ...(typeof attribute.target === "string" ? { target: attribute.target } : {}),
    ...(typeof attribute.component === "string" ? { component: attribute.component } : {}),
    ...(Array.isArray(attribute.components) ? { components: attribute.components } : {}),
    ...(typeof attribute.minLength === "number" ? { minLength: attribute.minLength } : {}),
    ...(typeof attribute.maxLength === "number" ? { maxLength: attribute.maxLength } : {}),
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
    attributes: Object.entries(contentType.attributes ?? {}).map(([name, attribute]) =>
      attributeDiscovery(name, attribute),
    ),
  };
}

function pluginStore(strapi) {
  return strapi.store({ type: "plugin", name: "rankpine" });
}

function version(strapi) {
  const configured = [
    strapi.config.get("info.strapiVersion"),
    strapi.config.get("info.strapi"),
  ].find((value) => typeof value === "string" && /^\d+(?:\.|$)/.test(value));
  if (configured) return configured;
  try {
    return String(require("@strapi/strapi/package.json").version);
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
    String(strapi.config.get("plugin::rankpine.rankpineUrl") ?? "https://rankpine.com"),
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
    return rows
      .map((locale) => ({
        code: locale.code,
        name: locale.name,
        isDefault: locale.isDefault === true,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
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
    pairedAt: connection.pairedAt,
  };
}

function liveAttribute(contentType, name) {
  return name ? contentType.attributes?.[name] : undefined;
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
    [mappings.date, ["date", "datetime", "timestamp"], "Article date"],
  ]) {
    if (name) expectField(contentType, name, allowed, role);
  }
  if (mappings.featuredMedia) {
    const media = expectField(contentType, mappings.featuredMedia, ["media"], "Featured media");
    if (media.multiple || (media.allowedTypes && !media.allowedTypes.includes("images"))) {
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
    if (
      documentIds.length > 1 &&
      ["oneToOne", "manyToOne", "morphToOne"].includes(attribute.relation)
    ) {
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
      ...Object.keys(mappings.relations ?? {}),
    ].filter(Boolean),
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
      const kind = attribute.type === "component" || attribute.type === "dynamiczone";
      throw new Error(
        kind
          ? `Required ${attribute.type} field ${name} is unsupported.`
          : !MAPPABLE_FIELD_TYPES.has(attribute.type)
            ? `Required ${attribute.type} field ${name} is unsupported.`
            : `Required field ${name} has no explicit RankPine value.`,
      );
    }
  }
  return { mappings, data: { ...data } };
}

async function findDocument(strapi, uid, identity, locale, draftAndPublish) {
  if (!identity?.field || typeof identity.value !== "string") return undefined;
  const matches = await strapi.documents(uid).findMany({
    filters: { [identity.field]: { $eq: identity.value } },
    ...(locale ? { locale } : {}),
    ...(draftAndPublish ? { status: "draft" } : {}),
    limit: 2,
  });
  if (matches.length > 1) throw new Error(`More than one document matches ${identity.field}.`);
  return matches[0]?.documentId;
}

export default ({ strapi, uploadImage = uploadFeaturedImage }) => ({
  async settings() {
    const stored = (await pluginStore(strapi).get({ key: "settings" })) ?? {};
    const connection = (await pluginStore(strapi).get({ key: "connection" })) ?? null;
    const contentTypes = Object.entries(strapi.contentTypes)
      .filter(
        ([uid, contentType]) => uid.startsWith("api::") && contentType.kind === "collectionType",
      )
      .map(([uid, contentType]) => contentTypeDiscovery(uid, contentType));
    return {
      strapiVersion: version(strapi),
      pluginVersion: "1.0.0",
      publicUrl: stored.publicUrl ?? "",
      selectedContentTypeUid: stored.selectedContentTypeUid ?? "",
      contentTypes,
      locales: await locales(strapi),
      connection: connectionView(connection),
      diagnostics: {
        https: typeof stored.publicUrl === "string" && stored.publicUrl.startsWith("https://"),
        lastRequestAt: stored.lastRequestAt ?? null,
        lastError: stored.lastError ?? null,
        telemetry: false,
      },
    };
  },

  async saveSettings(input) {
    const selected = selectedContentType(strapi, input.selectedContentTypeUid);
    const stored = (await pluginStore(strapi).get({ key: "settings" })) ?? {};
    const next = {
      ...stored,
      publicUrl: ensureHttps(input.publicUrl),
      selectedContentTypeUid: Object.entries(strapi.contentTypes).find(
        ([, contentType]) => contentType === selected,
      )?.[0],
    };
    await pluginStore(strapi).set({ key: "settings", value: next });
    return this.settings();
  },

  async createPairing() {
    const stored = (await pluginStore(strapi).get({ key: "settings" })) ?? {};
    selectedContentType(strapi, stored.selectedContentTypeUid);
    const baseUrl = publicUrl(strapi, stored);
    const token = createPairingToken();
    const expiresAt = new Date(Date.now() + PAIRING_MAX_AGE_MS);
    await strapi.db.query(PAIRING_UID).deleteMany({ where: { expiresAt: { $lt: new Date() } } });
    await strapi.db.query(PAIRING_UID).create({
      data: {
        tokenHash: sha256(token),
        contentTypeUid: stored.selectedContentTypeUid,
        expiresAt,
      },
    });
    const url = new URL("/connect/strapi", rankpineUrl(strapi));
    return {
      connectUrl: url.toString(),
      siteUrl: baseUrl,
      pairToken: token,
      expiresAt: expiresAt.toISOString(),
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
      if (
        !key ||
        !/^[A-Za-z0-9_-]{16,128}$/.test(key.keyId) ||
        !validateEd25519PublicKey(key.publicKeyPem)
      ) {
        throw new Error("RankPine sent an invalid signing key.");
      }
      const claimed = await strapi.db.query(PAIRING_UID).update({
        where: { id: row.id, consumedAt: { $null: true } },
        data: { consumedAt: new Date() },
      });
      if (!claimed) throw new Error("Pairing code was already used.");
      await pluginStore(strapi).set({
        key: "connection",
        value: {
          keyId: key.keyId,
          publicKeyPem: key.publicKeyPem,
          contentTypeUid: row.contentTypeUid,
          pairedAt: new Date().toISOString(),
        },
      });
    }
    return {
      strapiVersion: version(strapi),
      pluginVersion: "1.0.0",
      contentTypes: [contentTypeDiscovery(row.contentTypeUid, contentType)],
      locales: await locales(strapi),
      connection: consume
        ? {
            connected: true,
            keyId: key.keyId,
            contentTypeUid: row.contentTypeUid,
            pairedAt: new Date().toISOString(),
          }
        : { connected: false, contentTypeUid: row.contentTypeUid },
    };
  },

  async authenticate(ctx) {
    const connection = (await pluginStore(strapi).get({ key: "connection" })) ?? null;
    if (!connection?.keyId || !connection.publicKeyPem)
      throw new Error("RankPine is not connected.");
    const body = ctx.method === "GET" ? undefined : JSON.stringify(ctx.request.body ?? {});
    const result = verifySignedRequest({
      method: ctx.method,
      path: ctx.path,
      body,
      publicKeyPem: connection.publicKeyPem,
      expectedKeyId: connection.keyId,
      headers: ctx.headers,
    });
    if (!result.ok) throw new Error("Request signature is invalid, stale, or already used.");
    await strapi.db.query(NONCE_UID).deleteMany({ where: { expiresAt: { $lt: new Date() } } });
    try {
      await strapi.db.query(NONCE_UID).create({
        data: {
          nonceHash: sha256(result.nonce),
          expiresAt: new Date(Date.now() + PAIRING_MAX_AGE_MS),
        },
      });
    } catch {
      throw new Error("Request signature is invalid, stale, or already used.");
    }
    const stored = (await pluginStore(strapi).get({ key: "settings" })) ?? {};
    await pluginStore(strapi).set({
      key: "settings",
      value: { ...stored, lastRequestAt: new Date().toISOString(), lastError: null },
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
      connection: connectionView(connection),
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
    const locale = localized ? payload.locale : undefined;
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
        payload.articleId,
      );
    }
    const existingDocumentId =
      typeof payload.existingDocumentId === "string"
        ? payload.existingDocumentId
        : await findDocument(
            strapi,
            connection.contentTypeUid,
            payload.identity,
            locale,
            contentType.options?.draftAndPublish === true,
          );
    const documentApi = strapi.documents(connection.contentTypeUid);
    const status = contentType.options?.draftAndPublish
      ? payload.publishMode === "draft"
        ? "draft"
        : "published"
      : undefined;
    const result = existingDocumentId
      ? await documentApi.update({
          documentId: existingDocumentId,
          data,
          ...(locale ? { locale } : {}),
          ...(status ? { status } : {}),
        })
      : await documentApi.create({
          data,
          ...(locale ? { locale } : {}),
          ...(status ? { status } : {}),
        });
    if (!result?.documentId) throw new Error("Strapi did not return a documentId.");
    return {
      documentId: result.documentId,
      ...(typeof payload.publicUrl === "string" ? { url: ensureHttps(payload.publicUrl) } : {}),
      live: !contentType.options?.draftAndPublish || payload.publishMode === "published",
    };
  },

  async disconnect(ctx) {
    if (ctx) await this.authenticate(ctx);
    await pluginStore(strapi).set({ key: "connection", value: null });
    await strapi.db.query(NONCE_UID).deleteMany({ where: {} });
    return { disconnected: true };
  },

  async recordError(error) {
    const stored = (await pluginStore(strapi).get({ key: "settings" })) ?? {};
    await pluginStore(strapi).set({
      key: "settings",
      value: { ...stored, lastError: redactError(error) },
    });
  },
});
