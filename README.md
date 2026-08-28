# RankPine for Strapi 5

Securely connect one Strapi 5 collection type to [RankPine](https://rankpine.com) publishing. The plugin discovers the live schema, exposes a small native settings screen, and accepts only Ed25519-signed RankPine document upserts.

## Compatibility

- Strapi `>=5.33.2 <6`
- Node.js 20 or newer
- Collection types only; single types are not publishing targets
- Strapi 4 is not supported

## Install

The package is prepared but has not been published to npm. After its first approved npm release:

```bash
npm install @rankpine/strapi-plugin-rankpine
```

Restart Strapi and rebuild the Strapi admin panel as required by your deployment workflow. RankPine does not publish or deploy your Strapi project.

For local package validation before the npm release, link the workspace package with the Strapi Plugin SDK/yalc workflow described in the official Strapi 5 documentation.

## Configure

Open **Settings → RankPine** in Strapi:

1. Enter the public HTTPS URL of the Strapi server.
2. Select the target collection type.
3. Save settings.
4. Choose **Connect RankPine**.
5. Sign in to RankPine, choose the RankPine site, and explicitly map the body, title, UID/slug, and any optional fields.

The pairing code expires after ten minutes and works once. It is sent to RankPine through a top-level HTTPS form POST, never a query string, and is immediately held in an encrypted, signed, HTTP-only cookie. Rotating creates a new key and invalidates the previous RankPine signing key when pairing completes. **Disconnect** removes the stored public key immediately.

## Supported fields

- Body: Rich Text (Markdown), Blocks (native Blocks JSON), Text, or String
- Title, excerpt, SEO title/description, and canonical URL: compatible top-level scalar fields
- Slug: UID or unique String
- Featured image: one image Media field
- Date/DateTime/Timestamp
- Explicit Boolean and Enumeration values
- Explicit relation `documentId` values
- Draft & Publish and localized collection types

Components and dynamic zones are discovered but not written. Required components/dynamic zones block the connection or publish request. Optional ones are listed in diagnostics. The publishing layer never invents values for custom fields.

## Security and permissions

The plugin does not request or store a Strapi API token, password, or RankPine shared secret. Pairing stores an Ed25519 public key. RankPine stores the private key encrypted in its tenant-scoped integration record.

Every publish/discovery request includes a key ID, Unix timestamp, random nonce, and Ed25519 signature over the method, route, timestamp, nonce, and SHA-256 body digest. The plugin rejects stale requests and atomically claims nonce hashes to prevent replay.

Admin settings routes require Strapi admin authentication and plugin RBAC permissions. Public plugin routes accept only a one-time pairing code or a valid RankPine signature. Featured media downloads require public HTTPS, pin DNS to validated public addresses, revalidate redirects, cap files at 10 MB, and accept JPEG, PNG, WebP, or GIF only. SVG is rejected.

The plugin sends no analytics or telemetry. Pairing codes, keys, signatures, and article content are not logged by the plugin.

See [SECURITY.md](./SECURITY.md) for private vulnerability reporting.

## API-token fallback

The RankPine dashboard also supports a direct Strapi 5 API-token connection without this plugin. Use a custom Content API token limited to `find`, `findOne`, `create`, and `update` on the selected collection plus Upload `find` and `upload`. RankPine encrypts that token at rest.

## Support

- Setup and product support: support@rankpine.com
- Security reports: security@rankpine.com
- Documentation: https://rankpine.com/docs/integrations/strapi
- Issues: https://github.com/Blaumaus/rankpine-strapi-plugin/issues

Support covers the current Strapi 5 major and the latest stable RankPine plugin release. Security fixes are prioritized; compatibility fixes target supported Strapi 5 releases.

## Marketplace status

This package is technically prepared for npm and Strapi Marketplace review, but no npm or Marketplace publication has occurred. Current Marketplace rules prohibit plugin features gated by an offsite paywall. RankPine will not submit this connector unless Strapi confirms eligibility or the plugin-assisted feature is made independently free under those rules.

## License

MIT
