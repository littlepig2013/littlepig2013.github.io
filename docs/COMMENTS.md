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
