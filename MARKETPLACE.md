# RankPine Strapi plugin release and Marketplace handoff

Maintained source: `https://github.com/Blaumaus/rankpine-strapi-plugin`. Published npm package: `@rankpine/strapi-plugin-rankpine`. The package targets Strapi `>=5.33.2 <6` only and is MIT licensed.

The public repository and npm package are live. Nothing in this runbook authorizes Strapi Market submission, legal acceptance, deployment, or a real customer install.

## Current go/no-go

- **Private/local package development:** go.
- **Self-install from an approved public npm release:** technically go after clean Strapi 5 validation and owner approval.
- **Strapi Marketplace submission:** no-go under the rule checked on August 28, 2026. Strapi says the plugin and every feature must be completely free and cannot be blocked by an offsite or third-party paywall. RankPine is a paid SaaS. Obtain written Strapi eligibility confirmation or make plugin-assisted functionality independently free before submission.

Recheck the [Strapi Market guidelines](https://community.strapi.io/help/market-guidelines) immediately before any release or submission; policy can change.

## Listing copy

**Display name:** RankPine

**Package:** `@rankpine/strapi-plugin-rankpine`

**Short description (107 characters):**

> Securely connect a Strapi 5 collection to RankPine with explicit field mapping and signed document upserts.

**Long description:**

> RankPine publishes researched SEO articles into an explicitly selected Strapi 5 collection. The plugin discovers scalar, media, relation, component, dynamic-zone, locale, and Draft & Publish metadata, then pairs through a ten-minute single-use code. Strapi stores only an Ed25519 public key. Every discovery, publish, and disconnect request is timestamped, nonce-protected, and signed. Editors choose every mapped field; required unsupported structures stop publishing instead of losing data. A scoped Strapi Content API token remains available as a fallback in RankPine.

**Category suggestions:** Content management; SEO; Productivity.

**Compatibility:** Strapi `>=5.33.2 <6`; Node.js 20+.

**License:** MIT.

**Documentation:** `https://rankpine.com/docs/integrations/strapi`

**Support:** `support@rankpine.com`

**Security:** `security@rankpine.com`

**Repository:** `https://github.com/Blaumaus/rankpine-strapi-plugin`. Do not publish the npm package until that repository contains the tagged source.

**Logo assets:** `assets/rankpine-plugin-icon.png` is the prepared 512×512, 21,636-byte Marketplace image. The matching SVG source is retained beside it. Use the PNG because the written guidelines request JPG or PNG, even though the current form also accepts SVG and WebP. Do not submit the generic Strapi mark as RankPine's plugin logo.

## Permissions disclosure

### Strapi admin permissions

The plugin registers:

- `plugin::rankpine.settings.read` — view connection status, collection metadata, diagnostics, and non-secret settings;
- `plugin::rankpine.settings.update` — change the public URL/collection, create or rotate a pairing, and disconnect.

Every admin route also uses `admin::isAuthenticatedAdmin`. Navigation visibility is not treated as authorization.

### Public plugin routes

The Content API route group exposes:

- `GET /api/rankpine/pair` — inspect the selected non-secret schema with an unexpired pairing credential;
- `POST /api/rankpine/pair` — consume that credential once and store an Ed25519 public key;
- `GET /api/rankpine/discovery` — signed live schema and diagnostics;
- `POST /api/rankpine/publish` — signed field-filtered media upload and Document Service upsert;
- `POST /api/rankpine/disconnect` — signed public-key revocation.

These routes set Strapi's standard auth to false because they implement their own one-time credential or Ed25519 verification. They do not accept anonymous content operations.

### Data stored by the plugin

- selected content type UID and public Strapi URL;
- Ed25519 public key, key ID, and paired timestamp;
- hashed short-lived pairing codes and expiry/consumption timestamps;
- hashed request nonces and expiry timestamps;
- safe diagnostics: Strapi/plugin versions, HTTPS state, last signed-request time, and redacted last error.

The plugin stores no RankPine password, Strapi API token, Ed25519 private key, shared signing secret, analytics identifier, or article analytics. It sends no telemetry.

### Outbound access

Only a signed publish that includes a mapped featured image causes the plugin to download that public HTTPS image. DNS is resolved and pinned to public addresses, redirects are revalidated, responses are capped at 10 MB, and JPEG/PNG/WebP/GIF magic bytes are required. SVG is rejected.

## Support and maintenance policy

- Support the current Strapi 5 major and the latest stable plugin release.
- Acknowledge security reports within one business day; prioritize confirmed security fixes.
- Target ordinary compatibility/setup responses within two business days.
- Keep API-token publishing available when the plugin is unavailable or incompatible.
- Publish compatibility notes for every release and never claim Strapi 6 support before tests and a versioned adapter exist.
- Never collect credentials, pairings, content, or diagnostics through plugin telemetry.
- Give at least 90 days' notice before ending support for a stable Strapi 5 range, except when a security vulnerability requires a minimum patched version.

## Accounts and official submission links

A Strapi Cloud subscription is not required to publish a community plugin. The current plugin form is publicly accessible and asks for owner/contact details rather than a Strapi Cloud project. If Strapi prompts for an account, signing in at [Strapi Cloud](https://cloud.strapi.io/login) creates the account through GitHub, GitLab, Google, or magic link. That account is separate from every customer's Strapi admin account.

- [Strapi Market guidelines](https://community.strapi.io/help/market-guidelines) — recheck immediately before release.
- [Strapi plugin submission form](https://community.strapi.io/submit/plugin) — do not submit until eligibility is confirmed and explicit release approval is given.
- [Strapi community Marketplace](https://community.strapi.io/marketplace) — verify the live listing here after approval.
- [Strapi 5 plugin SDK guide](https://docs.strapi.io/cms/plugins-development/create-a-plugin) — official development and packaging reference.
- [Strapi 5 documentation](https://docs.strapi.io/) — install and compatibility reference.
- [npm account signup](https://www.npmjs.com/signup) — verify the email and enable 2FA.
- [npm organization creation](https://www.npmjs.com/org/create) — create or confirm the `rankpine` organization before using the `@rankpine` scope.
- [npm scoped public package guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) — the first release needs `--access public`.
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [provenance](https://docs.npmjs.com/generating-provenance-statements/) — prefer GitHub Actions OIDC over a long-lived npm token.
- [future npm package URL](https://www.npmjs.com/package/@rankpine/strapi-plugin-rankpine) — this will 404 until the approved first publication.
- [Public GitHub repository](https://github.com/Blaumaus/rankpine-strapi-plugin) — source, issues, releases, and provenance target.

## Eligibility email to send before submission

Send this to `market@strapi.io` before publishing specifically for Marketplace submission:

**Subject:** Eligibility question: free open-source Strapi connector for paid RankPine SaaS

> Hi Strapi Market team,
>
> We maintain `@rankpine/strapi-plugin-rankpine`, a Strapi 5-only plugin that we intend to release as open-source software under the MIT license. The plugin itself is free, contains no telemetry, stores no Strapi API token or RankPine private key, and uses a short-lived single-use pairing flow plus Ed25519-signed publishing requests. A scoped Strapi Content API token connection is also available without the plugin.
>
> RankPine is a paid SaaS, so useful ongoing operation of the connector requires a RankPine account and subscription. The current Market guidelines say that a plugin or any feature cannot be blocked by an offsite or third-party paywall. Would this connector be eligible for Strapi Market under the current rules?
>
> We will not submit the listing unless you confirm eligibility in writing. We can provide the public repository, npm package, permissions disclosure, security design, and validation results once you confirm the intended treatment.
>
> Thanks,
> RankPine
> support@rankpine.com

If Strapi says no, publish to npm only if separately approved and document manual installation; do not submit the Market form. If Strapi says yes, save the response with the release record and quote it in **Notes for Reviewers**.

## Marketplace form copy

Use the following after the package and repository URLs are live:

- **Plugin Name:** `RankPine`
- **Registry URL:** `https://www.npmjs.com/package/@rankpine/strapi-plugin-rankpine`
- **Repository URL:** `https://github.com/Blaumaus/rankpine-strapi-plugin`
- **Plugin Description:** `Securely connect a Strapi 5 collection to RankPine with explicit field mapping and signed document upserts.`
- **Plugin Logo / Icon:** `assets/rankpine-plugin-icon.png`
- **Categories:** choose the form's closest available values to `SEO & Marketing` and `Content management`; do not invent category labels if the live select differs.
- **README / Documentation:** public repository README URL plus `https://rankpine.com/docs/integrations/strapi`
- **Owner / Author Name:** `RankPine`
- **Contact Email:** `support@rankpine.com`
- **Terms:** accept personally only after rereading the linked terms and guidelines.

**Notes for Reviewers:**

> Strapi 5-only connector targeting `>=5.33.2 <6`. Built with Plugin SDK 6.1.1 and Design System v2. The plugin provides a native Settings → RankPine screen, collection discovery, diagnostics, revocation, and signed Document Service upserts. Pairing codes expire after ten minutes and are single use. The plugin stores only an Ed25519 public key; RankPine stores the tenant-scoped private key encrypted. Signed requests use timestamps and atomically claimed nonces to prevent replay. Media fetches require public HTTPS, pinned public DNS, redirect revalidation, a 10 MB cap, and image magic-byte validation. No telemetry or secrets are logged. Admin routes require Strapi admin authentication and plugin RBAC; public routes require a one-time pairing credential or valid signature. Components and dynamic zones are discovered but never silently written. Required unsupported structures block publishing. API-token publishing remains available as a fallback. Strapi Market eligibility for the paid-SaaS connection was confirmed by [reviewer/name/date/link or attached email].

Remove the final eligibility sentence only if the reviewer explicitly instructs you to; never imply confirmation that was not received.

## Local validation gate

Allowed without a production build:

```bash
bun run --filter @rankpine/strapi-plugin-rankpine test
bun run --filter @rankpine/strapi-plugin-rankpine validate
node --test packages/integrations/src/publishers/strapi.test.ts
bun run --filter @rankpine/integrations typecheck
bun run --filter @rankpine/web typecheck
git diff --check
```

The official Plugin SDK release gate also requires `build` and `verify`:

```bash
bun run --filter @rankpine/strapi-plugin-rankpine build
bun run --filter @rankpine/strapi-plugin-rankpine verify
```

## Validation completed on August 28, 2026

- RankPine migration `0066_overjoyed_ezekiel_stane.sql` applied successfully to the configured database; `integration_type` now includes `strapi`.
- `bun install`: passed, 1,081 packages installed.
- Plugin SDK `build`: passed; ESM and CommonJS admin/server bundles emitted in `dist/`.
- Plugin SDK `verify`: passed; `package.json` and exported files verified.
- Plugin package validation: passed.
- Plugin unit/security tests: passed, 9/9.
- Standalone `npm pack --dry-run` for `1.0.1`: passed; the package is approximately 49.1 kB, 130.2 kB unpacked, with SHA-1 `cd76228acc1ea5d8b0453fda7a1236e0753ae697` and 15 files, including the Marketplace PNG.
- `packages/jobs/src/publish.test.ts`: passed, 4/4, including Strapi duplicate prevention after migration.
- Direct shipped runtime dependency audit (`undici@8.10.0`): 0 vulnerabilities.
- Standalone plugin install with its required Strapi peer/dev tree: 18 advisories (4 low, 13 moderate, 1 high). The high advisory is `GHSA-866g-f22w-33x8` through Strapi 5.52.2's `@strapi/content-type-builder` AI SDK tree. It is not introduced by RankPine's direct runtime dependency, but it remains a Marketplace/release gate until Strapi ships a fixed dependency tree or the reviewer explicitly accepts the upstream exposure. Do not run the suggested forced audit fix because it would downgrade the peer installation to Strapi 4, which this plugin intentionally does not support.
- Whole-workspace `bun audit --audit-level=high`: failed with 6 high advisories across RankPine and Strapi dev/peer dependency paths. Do not represent the whole repository as audit-clean.
- npm `1.0.0` bootstrap publication: succeeded; anonymous registry lookup returned SHA-1 `4954f31cf4478e5f632509ab35fdb61eb4eb2974` and SHA-512 integrity `sha512-yHW2+gk/W2RFcRsLL2K5czpa5RG9TO57pAN5yPWlsr71+ugoaFFBoTdvvlF/cmKMan2EjTuDD3naK02OzH0S9g==`.
- GitHub Actions trusted publisher: configured for `Blaumaus/rankpine-strapi-plugin`, workflow `release.yml`, with publish permission and no repository secret.
- Targeted `oxfmt --check` and `git diff --check`: passed.

## Release checklist

### Package and code

- [x] Confirm the public repository URL and issue tracker.
- [x] Confirm package ownership and npm organization access.
- [ ] Recheck the latest stable Strapi 5 range and minimum patched version.
- [ ] Install/link into a disposable Strapi 5 project with Blocks, Rich Text, media, relation, component, dynamic-zone, i18n, and Draft & Publish fixtures.
- [ ] Exercise pairing expiry, simultaneous replay, rotation, both-side disconnect, schema drift, and invalid signature handling.
- [ ] Exercise create, ambiguous retry recovery, explicit update by `documentId`, draft, publish, two locales, image duplicate recovery, and provider failures.
- [ ] Confirm Strapi admin RBAC with a read-only plugin role and an update-capable plugin role.
- [ ] Confirm no token, private key, pairing code, signature, article body, or image bytes enter logs or analytics.
- [ ] Re-run dependency audit and resolve or obtain documented upstream disposition for known high/critical vulnerabilities.
- [x] Run Plugin SDK `build` and `verify`.
- [x] Inspect `npm pack --dry-run` and create the local tarball with the PNG included.
- [x] Review README, LICENSE, SECURITY, changelog, compatibility, support policy, and permissions disclosure.

### Visual and product QA

- [ ] Inspect Settings → RankPine at desktop and narrow widths in the current Strapi 5 admin.
- [ ] Confirm Design System v2 components and visible keyboard focus.
- [ ] Confirm connection status, collection selection, rotate, disconnect, diagnostics, error, and loading states.
- [ ] Verify RankPine dashboard connection, calendar/article label, marketing marquee, and docs page in a browser.
- [ ] Verify reduced-motion behavior on the landing integration marquee.

### External release boundary

- [x] Obtain explicit approval to create/push the public repository if needed.
- [x] Obtain explicit approval to publish the npm package.
- [x] Log in to npm and complete 2FA only after approval.
- [x] Publish the bootstrap package and record the package URL, integrity, and tarball contents; future releases use trusted-publisher provenance.
- [ ] Install the public tarball into a clean Strapi 5 fixture and repeat the critical smoke tests.
- [ ] Obtain written Strapi confirmation that a paid-SaaS connector is eligible, or document the independently free plugin-assisted feature.
- [ ] Recheck and personally accept current Strapi Market terms/guidelines.
- [ ] Obtain explicit approval before submitting the Marketplace record.
- [ ] Record submission ID/status and answer reviewer questions without widening permissions.
- [ ] Do not call the listing live until the public Market page and installation from it are verified.

## Remaining external proof

Local tests cannot prove compatibility with a real Strapi admin installation, provider-specific Upload adapter, production reverse proxy/body limits, deployed HTTPS/DNS, public npm installation, or Marketplace eligibility. Those checks require a disposable real Strapi 5 fixture and explicit approval for every publication/submission action.
