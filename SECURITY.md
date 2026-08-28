# Security

Report vulnerabilities privately to security@rankpine.com. Do not open a public issue for a suspected vulnerability.

The plugin stores no RankPine password, Strapi API token, or shared signing secret. It stores a RankPine Ed25519 public key, hashes pairing codes and request nonces, and rejects stale or replayed signed requests. Pairing codes travel in a top-level HTTPS form POST rather than a URL. Disconnecting removes the public key immediately.

RankPine does not collect Strapi admin credentials. The plugin sends no analytics or telemetry. Diagnostics contain only version, HTTPS, selected collection, shortened key ID, and timestamps.
