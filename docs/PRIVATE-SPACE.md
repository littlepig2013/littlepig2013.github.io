# Private content migration

## Current state and release boundary

`private-space/` adds a private application for review. It is excluded from the
Jekyll build and is deployed separately. Public research pages keep their current
hosting. This PR deliberately does not switch links or delete public articles
before the private application is configured and checked.

Deployment requires the owner's Cloudflare account configuration and login email.
These are not inferred from an academic contact address. Account settings, DNS,
database/bucket IDs and Access application AUD cannot be invented by the code.

## Content migration checklist

1. Deploy and verify the private application first. Log in as the owner.
2. Recreate the existing Journal entries privately as owner-only articles, pairing
   their Chinese and English versions under one article ID:
   - `life-as-an-open-field`: the two October 4 entries.
   - `seeing-the-world-seeing-ourselves`: the two October 5 entries.
   Recreate Music / Ballroom posts privately if those should require friend access.
3. Upload any protected videos/audio/images into the private R2 bucket. Public
   Google Drive, YouTube, GitHub or CDN links stay accessible independently of
   the new permission checks. Restrict/remove the old sources separately after
   checking playback in the new application. Do not commit uploaded media or
   private article text to the public repository.
4. Remove the migrated public post files and replace Music / Ballroom / Journal
   landing-page content with links to the confirmed private hostname. Audit all
   homepage cards, `personal-posts.html`, search, feed.xml, sitemap, tag/category
   archives, Open Graph descriptions, translation links and media references.
   No private title/excerpt should appear in the public build.
5. Private articles do not load giscus. Review existing public GitHub Discussions
   for sensitive titles, comments and quotations; limiting the website does not
   limit those discussions. Deletion/cleanup is a separate owner decision.
6. Build Jekyll and inspect its complete output for migrated titles, excerpts and
   media URLs. Check the old article URLs on both `zichen.me` and the original
   GitHub Pages domain, as well as current published GitHub source.
7. Recheck all access modes in the actual deployment: owner, ordinary friend,
   selected article recipient, Journal circle, revoked friend, and uninvited user.
8. Switch navigation only after the private copy works. Existing public Git
   history, copies, caches and downloads are not erased by removing current files.
   Do not promise retroactive privacy for previously published articles.

## API summary

| Route | Access | Purpose |
| --- | --- | --- |
| GET `/api/me` | Owner / active friend | Current verified identity |
| GET `/api/posts` | Owner / active friend | Permitted titles only |
| GET `/api/posts?as=email` | Owner | Reader preview, titles only |
| GET `/api/posts/:id` | Article permission | Both language versions and media list |
| GET `/api/media/:id/:file` | Article permission | Private media, including ranges |
| GET/PUT `/api/admin/friends` | Owner | Manage email grants / revoke |
| GET `/api/admin/posts` | Owner | Editor data and explicit reader grants |
| PUT `/api/admin/posts/:id` | Owner | Atomically save article and grants |
| PUT `/api/admin/posts/:id/media/:file` | Owner | Upload media under the article |

Permissions are stored in D1, not in the signed-in browser, public source files,
an editable JWT claim or a copied invitation URL. A friend can verify their
mailbox only; the configured owner email is the sole administrative identity.
