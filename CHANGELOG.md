# Changelog

## 1.2.0 (unreleased)

### Breaking/behaviour changes

- The Next.js relay rejects unauthenticated upstream requests. Hosts must supply `getUserId` and shared `sessionOwnership` for session routes. Backfill existing session owners from trusted records before upgrading to preserve resumability.
- GPU prewarm is denied until the host configures a separate `authorizePrewarm` callback that checks permission and consumes a rate limit.
- Credentialed relay calls reject upstream redirects and disable caching.
