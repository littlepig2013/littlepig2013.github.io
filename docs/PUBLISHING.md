# Publishing your personal site

## Site structure
- Homepage: `_pages/about.md`
- Research: `_pages/research.md`; existing publications: `_pages/publications.md`
- Dance, music, journal: `_pages/dance.html`, `_pages/music.html`, `_pages/journal.html`
- Design: `assets/css/personal.css`; shared layout: `_layouts/personal.html`
- Navigation: `_data/navigation.yml`

The portrait was updated in October 2026; the existing CV is reused from the repository. The CV has not been rewritten or certified current. Research biography and milestones come from the BU homepage. Journal and music entries use owner-provided content and media. Original template examples remain in source but are excluded from the built site.

## Publish a journal entry or dance/music video
Copy `_drafts/personal-entry.md` to `_posts/YYYY-MM-DD-your-title.md`, using the actual publishing date (future dates are hidden by Jekyll). Replace the title, excerpt and content. Set `categories: [dance]`, `[music]`, or `[life]`. Dance and music entries appear on their topic page and in the journal. Set `lang: zh-CN` for a Chinese entry. Keep `comments: true` to display comments.

Embed YouTube:
```liquid
{% include personal-video.html youtube_id="YOUR_VIDEO_ID" title="My dance performance" %}
```
For Google Drive, upload to your personal account, wait for video processing, and set **Share → General access → Anyone with the link → Viewer**. Open the link in a signed-out browser to confirm playback. From `https://drive.google.com/file/d/FILE_ID/view`, copy just `FILE_ID`:
```liquid
{% include personal-video.html drive_id="FILE_ID" title="My performance" portrait=true %}
```
For 光阴的故事, edit only `_data/media.yml`: fill `story_of_time.drive_id` or `youtube_id`. Leave the other blank. The current portrait poster stays visible until a host ID is added; there is no broken or pretend player. YouTube takes precedence if both are filled. A Drive embed includes an external watch link in case inline playback fails.

Keep full videos and original photo collections outside Git. Keep optimized profile photos and small video posters in `assets/images/`. Drive works for video previews; use a video host such as YouTube for a growing collection. Do not use temporary download URLs or Drive sharing URLs as image `src` values. Public Drive links can reveal the file owner's name and email.

For an externally hosted MP4 with a stable public URL, or an intentionally small local MP4, use:
```liquid
{% include personal-video.html src="/assets/videos/performance.mp4" %}
```
Use YouTube or another video host for larger videos rather than filling the Git repository.

## Activate public comments (one-time owner setup)
1. Repository Settings → General → Features → enable **Issues**.
2. Install https://github.com/apps/utterances and grant access only to `littlepig2013.github.io`.
3. Set `personal_comments.enabled: true` in `_config.yml` and commit.
4. Open a published entry, sign in with GitHub, post a comment, and verify that a matching GitHub issue is created.

Comments are public, use GitHub login, and are stored in Issues. Moderate them on GitHub. Pathname mapping keeps threads stable across the github.io and zichen.me domains; avoid changing published permalinks. There are no secrets to configure. Until setup is complete, the site shows an email contact instead of a broken widget. The homepage and topic indexes do not create comment threads.

## Build
The existing GitHub Pages/Jekyll deployment stays in place. `CNAME` remains `zichen.me`, and `_config.yml` uses `https://zichen.me` for canonical URLs. Merging the redesign PR into the configured Pages source branch will update the public site.

Local preview:
```sh
bundle install
bundle exec jekyll serve
```
Visit http://localhost:4000. Run `bundle exec jekyll build` before publishing. The redesign uses no JavaScript framework, runtime backend, or new Jekyll plugin.
