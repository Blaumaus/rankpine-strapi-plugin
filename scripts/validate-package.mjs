import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

assert.equal(pkg.license, "MIT");
assert.equal(pkg.strapi?.kind, "plugin");
assert.match(pkg.peerDependencies?.["@strapi/strapi"] ?? "", /^>=5\./);
assert.ok(pkg.keywords.includes("strapi"));
assert.ok(pkg.keywords.includes("plugin"));
assert.equal(pkg.private, undefined);
assert.equal(pkg.publishConfig?.access, "public");

for (const path of [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CHANGELOG.md",
  "assets/rankpine-plugin-icon.svg",
  "assets/rankpine-plugin-icon.png",
  "admin/src/index.tsx",
  "admin/src/pages/Settings.tsx",
  "server/src/index.js",
  "server/src/routes/index.js",
  "server/src/security.js",
]) {
  await access(join(root, path));
}

const translations = await readdir(join(root, "admin/src/translations"));
assert.deepEqual(translations, ["en.json"]);

const routes = await readFile(join(root, "server/src/routes/index.js"), "utf8");
assert.match(routes, /admin::isAuthenticatedAdmin/);
assert.match(routes, /plugin::rankpine\.settings\.update/);
assert.match(routes, /auth: false/);

const security = await readFile(join(root, "server/src/security.js"), "utf8");
assert.match(security, /ed25519/);
assert.match(security, /SIGNATURE_MAX_AGE_SECONDS/);

const service = await readFile(join(root, "server/src/services/rankpine.js"), "utf8");
assert.match(service, /connectUrl/);
assert.doesNotMatch(service, /searchParams\.set\("pair_token"/);

const settings = await readFile(join(root, "admin/src/pages/Settings.tsx"), "utf8");
assert.match(settings, /form\.method = "post"/);
assert.doesNotMatch(settings, /location\.assign/);

const admin = await readFile(join(root, "admin/src/index.tsx"), "utf8");
assert.match(admin, /bootstrap\(app/);
assert.match(admin, /addSettingsLink\("global"/);

console.log("RankPine Strapi plugin package validation passed.");
