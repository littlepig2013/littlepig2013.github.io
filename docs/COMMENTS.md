# Comments, replies, and reactions

The journal uses [Giscus](https://giscus.app), backed by GitHub Discussions. Reading is public; commenting, replying, and reacting requires GitHub login and authorization of Giscus. The static site needs no database server or secret.

## Activate once

1. Open [repository settings](https://github.com/littlepig2013/littlepig2013.github.io/settings). Under General → Features, enable **Discussions**.
2. Install the [Giscus GitHub App](https://github.com/apps/giscus), granting access only to `littlepig2013.github.io`.
3. Open [Giscus configuration](https://giscus.app/zh-CN), enter `littlepig2013/littlepig2013.github.io`, and select **Announcements** (or another category of type **Announcement**). This restricts creation of top-level discussions to maintainers and the app while allowing readers to comment.
4. Copy the generated `data-category-id` into `personal_comments.category_id` in `_config.yml`. Verify `data-repo-id` matches `personal_comments.repository_id`. If you choose another category, update `personal_comments.category` too.
5. Set `personal_comments.enabled: true`, commit, and wait for GitHub Pages to publish.

These IDs are public configuration, not secrets. Never put a GitHub access token in the site. The widget stays hidden until enabled with both IDs present, showing an email fallback instead of a broken widget.

## Stable threads and translations

Discussion identity uses `page.comment_thread`, then `page.translation_of`, then `page.url`. Both current English translations have `translation_of`, so Chinese and English pages share comments and article reactions. Changing domains keeps the discussion. Preserve published paths; if renaming a permalink, set `comment_thread` to its original path on all versions.

Strict matching prevents similar article names from selecting the wrong discussion. Giscus creates a discussion on the first comment or reaction. The composer appears above comments; article reactions are enabled, and language follows the page. Lazy iframe loading avoids blocking the article.

## Reply and like behavior

Giscus supplies replies and GitHub reactions, including 👍. GitHub Discussions groups replies beneath a top-level comment, rather than supporting arbitrary nesting depth. Further conversation stays in that reply thread. Likes belong to signed-in accounts, not local browser counters. Article reactions and comment reactions are separate.

## Moderation and availability

Manage comments in the repository's **Discussions** tab. Use GitHub moderation controls to remove abusive content, lock conversations, or block users. GitHub login raises the barrier to spam but does not eliminate it. Comments and linked account profiles are public. GitHub/Giscus outages or blocking can affect the widget; the article and email fallback remain available.

The old Utterances widget was disabled, and repository Issues are currently disabled. If prior issue-based comments are discovered, migrate them to Discussions and align titles and strict-matching hashes before activation; they will not automatically appear in the new widget.

## Live verification after activation

- Open a Chinese entry; confirm Chinese controls and no configuration error.
- Sign in and comment; verify a discussion appears in the chosen category.
- From a second account, reply and react with 👍; refresh and check persistence.
- Add an article reaction, then remove it; verify the count updates.
- Open its English translation; verify the same conversation with English controls.
- Open a different article; verify it has its own discussion.
- Check mobile layout and signed-out reading. Block the widget and check the GitHub/email fallback.

These checks require owner activation. Template validation cannot verify live OAuth, app permissions, or reaction persistence.

## Security hardening

- `giscus.json` allows only `https://zichen.me`, `https://www.zichen.me`, and `https://littlepig2013.github.io`. This prevents unrelated sites embedding this discussion repository through Giscus; it is not access control for public GitHub discussions or DDoS protection. Do not add broad wildcard origins. Local testing can use mocked origins; add an exact temporary origin only if needed and remove it before merging.
- The personal layout uses a Content Security Policy in a meta tag before resources. Scripts are limited to this site and the exact Giscus client path; inline scripts and `eval` are not permitted. Frames are restricted to this site, Giscus, and existing YouTube/Drive embeds. Object embeds, base-tag overrides, and HTML form submissions are blocked. Inline styles remain allowed for Giscus iframe sizing. This policy applies to the personal layout only; a meta policy cannot enforce `frame-ancestors` or all HTTP-header-only protections.
- The Giscus client script has a pinned SHA-384 Subresource Integrity digest, checked against the official HTTPS response on 2026-10-05. CORS is supported by that endpoint. A changed client fails closed: the comment widget will stop loading until the new script has been reviewed and its digest explicitly updated. Keep the email/GitHub fallback. Never auto-refresh the digest. This pins the loader only, not the cross-origin widget, its styles, or GitHub API responses; Giscus remains a trusted service.
- Cross-origin referrers omit article paths and query parameters. `giscus:backlink` uses the canonical original article, without OAuth callback query parameters.
- Configuration attributes are HTML-escaped. Strict thread matching and stable translation keys avoid cross-article thread confusion.

For activation, use **Only select repositories** when installing Giscus, select only this repository, and inspect the permissions shown by GitHub. Choose an Announcement category as described above. Granting access to all repositories is unnecessary. Enable GitHub account two-factor authentication if it is not already on. Moderation and rate limiting remain GitHub responsibilities; this integration does not enforce a custom daily quota or character limit.

To update the loader pin: download `https://giscus.app/client.js` over HTTPS, review the change against the previously reviewed loader, compute its SHA-384 SRI digest, update only the `integrity` attribute, and run the browser checks again. If it cannot be reviewed, leave the pin unchanged and use the fallback. The current reviewed loader digest is recorded directly in `_includes/personal-comments.html`.
