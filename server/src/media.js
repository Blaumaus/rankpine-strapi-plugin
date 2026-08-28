import { lookup } from "node:dns/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Agent, fetch } from "undici";

import { isPrivateAddress, redactError, sha256 } from "./security.js";

const MAX_BYTES = 10_000_000;
const MAX_REDIRECTS = 3;

async function target(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Featured media must use a public HTTPS URL.");
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address.address))) {
    throw new Error("Featured media resolved to a private or unsafe address.");
  }
  return { url, addresses };
}

function pinnedLookup(addresses) {
  return (_hostname, options, callback) => {
    if (options?.all) {
      callback(
        null,
        addresses.map(({ address, family }) => ({ address, family })),
      );
      return;
    }
    const preferred =
      addresses.find((address) => address.family === options?.family) ?? addresses[0];
    callback(null, preferred.address, preferred.family);
  };
}

async function readCapped(response) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error("Featured media exceeds the 10 MB limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function detectImage(body) {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    body.length >= 8 &&
    body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    body.length >= 12 &&
    body.toString("ascii", 0, 4) === "RIFF" &&
    body.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  if (body.length >= 6 && /^GIF8[79]a$/.test(body.toString("ascii", 0, 6))) {
    return { mime: "image/gif", extension: "gif" };
  }
  throw new Error("Featured media must be a JPEG, PNG, WebP, or GIF. SVG is not accepted.");
}

export async function downloadPublicImage(input) {
  let current = input;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const { url, addresses } = await target(current);
    const dispatcher = new Agent({ connect: { lookup: pinnedLookup(addresses) } });
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        dispatcher,
        signal: AbortSignal.timeout(15_000),
        headers: { "user-agent": "RankPine-Strapi-Plugin/1.0" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => {});
        if (!location) throw new Error("Featured media redirect had no destination.");
        current = new URL(location, url).toString();
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`Featured media returned HTTP ${response.status}.`);
      }
      const body = await readCapped(response);
      return { body, ...detectImage(body) };
    } finally {
      await dispatcher.close().catch(() => {});
    }
  }
  throw new Error("Featured media redirected too many times.");
}

export async function uploadFeaturedImage(strapi, image, articleId) {
  if (!image?.url || typeof image.url !== "string") return undefined;
  const identity = `rankpine-${sha256(String(articleId || image.url)).slice(0, 24)}`;
  const existing = await strapi.db.query("plugin::upload.file").findMany({
    where: { name: identity },
    limit: 2,
  });
  if (existing.length > 1) throw new Error("More than one RankPine media item has this identity.");
  if (existing[0]?.id !== undefined) return existing[0].id;

  const downloaded = await downloadPublicImage(image.url);
  const directory = await mkdtemp(join(tmpdir(), "rankpine-strapi-"));
  const filename = `${identity}.${downloaded.extension}`;
  const path = join(directory, filename);
  try {
    await writeFile(path, downloaded.body, { flag: "wx", mode: 0o600 });
    const uploaded = await strapi
      .plugin("upload")
      .service("upload")
      .upload({
        data: {
          fileInfo: {
            name: identity,
            alternativeText:
              typeof image.alt === "string"
                ? image.alt.replace(/[\r\n\t]+/g, " ").slice(0, 500)
                : "",
          },
        },
        files: {
          path,
          name: filename,
          type: downloaded.mime,
          size: downloaded.body.length,
        },
      });
    const id = uploaded?.[0]?.id;
    if (id === undefined) throw new Error("Strapi Upload did not return a media ID.");
    return id;
  } catch (error) {
    throw new Error(`Featured media upload failed: ${redactError(error)}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
