# Private space for Zichen's website

This is a companion Cloudflare Worker, not a password overlay for Jekyll.
Research remains public at `zichen.me`. Put the companion on a private hostname
such as `friends.zichen.me`, protected by Cloudflare Access with email one-time PIN.
The hostname is a proposal; no DNS or hosting changes have been made.

**Status: implementation for review, not deployed. Existing Music, Ballroom,
Journal, public media links and GitHub Discussions remain public as before.
Merging this directory does not make those existing copies private.**

## Behavior

- Only the configured owner can manage friends, articles, language versions and media.
- An owner adds an email; the friend verifies that email through Cloudflare Access.
  No invitation email is sent by this app. Share the private hostname manually.
- New friends receive Music and Ballroom permissions; Journal circle is off.
- New articles default to owner-only. For Music / Ballroom choose `section` to
  share with friends holding that section permission. Journal supports `self`,
  `selected` (explicit emails), or `circle` (friends holding Journal permission).
- Explicit per-article permission is an intentional exception to section access;
  it opens only that article. Granting one Journal article does not open the circle.
- Chinese / English versions are stored in one article with one permission policy.
- Unauthorized article titles and bodies are not included in API responses.
  Owner preview returns allowed titles only and cannot be used by friends.
- An inactive friend cannot access the shell, articles or media, even if an Access
  session is still valid. Every request rereads the friend and article policy.
- Original media URLs require the same permission as the parent article. R2 must
  have public access disabled. Authorized playback supports single byte ranges.
- No giscus, analytics, external fonts, external media embeds or private RSS feed.
  Text is rendered using `textContent`, without accepting arbitrary HTML.
- Revocation blocks future requests. Bytes already viewed, downloaded, buffered
  or captured by the recipient cannot be recalled.

## Configure and deploy

1. Use Node 22.13+ and run `npm test` in this directory. The application itself
   uses native Web Crypto and Worker APIs, with no runtime npm dependencies.
2. In your Cloudflare account create a D1 database and a private R2 bucket.
   Keep R2 public domains and `r2.dev` disabled. Do not put articles or media in
   this repository or the `public/` directory.
3. Copy `wrangler.example.toml` to ignored `wrangler.toml`. Supply the actual
   database ID, bucket, owner login email, and selected private hostname.
   Disable Worker preview URLs and `workers.dev` to avoid extra origins.
4. In Zero Trust create a self-hosted Access application for the entire private
   hostname, including all `/api/*`, JS and media paths. Enable One-time PIN.
   Use an Allow policy that requires authenticated email identity. You may allow
   all successfully authenticated emails at this outer layer, since the Worker
   still requires the owner or an active friend in D1. Never use Bypass policies.
   If you instead maintain an explicit outer email allowlist, add each invited
   email there as well. Access blocks unknown identities without revealing titles.
5. Copy the Access team domain and application AUD into the Worker variables.
   The Worker cryptographically verifies the JWT header, issuer, AUD and expiry;
   it does not trust an unsigned email header. There is no production auth bypass.
6. Initialize the database: `npx wrangler d1 execute zichen-private-space --remote
   --file=schema.sql`. Then deploy with `npm run deploy` after completing the
   hostname configuration in `wrangler.toml`.
7. Log in with the configured owner email. Add friends and enter/import private
   articles through the editor. The editor accepts plain text, not Markdown or
   HTML formatting in this first version. Media uploads support the listed MP4,
   audio and image MIME types, up to 50 MiB per file.
8. Test with a separate invited mailbox, an uninvited mailbox, and a friend whose
   permissions have been revoked. Verify that direct media URLs are denied and
   Access protects the complete hostname. Test actual video seeking on Cloudflare.
9. Follow the migration checklist in `../docs/PRIVATE-SPACE.md` before changing
   navigation or claiming the old Journal is private.

Assets use `run_worker_first = true`; the Worker authenticates before serving
them. All success and error responses are `private, no-store`, `noindex`, and use
a restrictive CSP. API writes require the owner and a matching Origin.

## Local development and tests

`npm test` covers JWT tampering, issuer/audience/expiry, uninvited users, section
and per-article grants, bilingual content, owner-only operations, CSRF rejection,
revocation, hidden metadata and authorized media ranges. Tests use SQLite with
a D1-compatible adapter and a simulated R2 binding. They are not a substitute
for Cloudflare runtime and browser validation after account configuration.

`npm run dev` starts Wrangler once configuration exists. There is deliberately
no "pretend owner" mode, so use Access for an authenticated deployment to test
the actual browser flow. Tests inject identity only through the exported handler
factory; production exports always use the JWT authenticator.

## Reference documentation

- [Validate Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [One-time PIN](https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/)
- [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Worker static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
