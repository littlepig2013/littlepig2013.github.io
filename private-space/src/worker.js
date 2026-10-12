import { authenticate, HTTPError, normalizeEmail } from './auth.js';

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const FILE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/;
const JSON_LIMIT = 1024 * 1024;
const MEDIA_LIMIT = 50 * 1024 * 1024;
const TYPES = new Set(['video/mp4', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'image/jpeg', 'image/png', 'image/webp']);
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const json = (data, status = 200) => Response.json(data, { status });
const fail = (status, message) => { throw new HTTPError(status, message); };

async function readJSON(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'JSON required');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Request body required');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > JSON_LIMIT) { await reader.cancel(); fail(413, 'Request too large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) { if (error instanceof HTTPError) throw error; fail(400, 'Invalid JSON'); }
}

export async function principal(env, email) {
  const owner = email === normalizeEmail(env.OWNER_EMAIL);
  const friend = owner ? null : await env.DB.prepare('SELECT * FROM friends WHERE email = ? AND active = 1').bind(email).first();
  return { email, owner, friend };
}

export async function canRead(env, person, post) {
  if (person.owner) return true;
  if (!person.friend || post.visibility === 'self') return false;
  if (post.visibility === 'selected') {
    return !!await env.DB.prepare('SELECT 1 FROM readers WHERE post_id = ? AND email = ?').bind(post.id, person.email).first();
  }
  if (post.section === 'journal') return post.visibility === 'circle' && !!person.friend.journal;
  return post.visibility === 'section' && !!person.friend[post.section];
}

function parsePost(post, full = false) {
  const variants = JSON.parse(post.variants);
  return {
    id: post.id, section: post.section, visibility: post.visibility, updated_at: post.updated_at,
    variants: full ? variants : Object.fromEntries(Object.entries(variants).map(([lang, value]) => [lang, { title: value.title }])),
    ...(full ? { media: JSON.parse(post.media) } : {})
  };
}

async function listPosts(env, person) {
  // Body text is never selected for listings or reader previews.
  const { results } = await env.DB.prepare("SELECT id, section, visibility, updated_at, json_remove(variants, '$.zh.body', '$.en.body') AS variants FROM posts ORDER BY updated_at DESC").all();
  const allowed = [];
  for (const post of results) if (await canRead(env, person, post)) allowed.push(parsePost(post));
  return allowed;
}

function validatePost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Invalid article');
  const { section, variants } = input;
  const visibility = input.visibility ?? 'self';
  if (!['music', 'dance', 'journal'].includes(section) ||
      !(section === 'journal' ? ['self', 'selected', 'circle'] : ['self', 'selected', 'section']).includes(visibility)) fail(400, 'Invalid visibility');
  if (!variants || typeof variants !== 'object' || Array.isArray(variants) ||
      !Object.keys(variants).length || Object.keys(variants).some(k => !['zh', 'en'].includes(k))) fail(400, 'Invalid language versions');
  const clean = {};
  for (const [lang, value] of Object.entries(variants)) {
    if (!value || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200 ||
        typeof value.body !== 'string' || value.body.length > 200000) fail(400, 'Invalid article text');
    clean[lang] = { title: value.title.trim(), body: value.body };
  }
  const readers = input.readers ?? [];
  if (!Array.isArray(readers) || readers.length > 100) fail(400, 'Invalid readers');
  return { section, visibility, variants: clean, readers: visibility === 'selected' ? [...new Set(readers.map(normalizeEmail))] : [] };
}

export function createHandler(verify = authenticate) {
  return async (request, env) => {
    let response;
    try {
      if (!env.DB || !env.MEDIA || !env.ASSETS) fail(503, 'Private space is not configured');
      const email = await verify(request, env);
      const person = await principal(env, email);
      if (!person.owner && !person.friend) fail(403, 'Access has not been granted');
      const url = new URL(request.url);
      const path = url.pathname;
      if (!['GET', 'HEAD', 'PUT'].includes(request.method)) fail(405, 'Method not allowed');
      if (request.method === 'PUT') {
        if (!person.owner) fail(403, 'Owner access required');
        if (request.headers.get('Origin') !== url.origin) fail(403, 'Same-origin request required');
        if (request.headers.get('Sec-Fetch-Site') === 'cross-site') fail(403, 'Same-origin request required');
      }
      if (request.method === 'HEAD' && path.startsWith('/api/')) fail(405, 'Method not allowed');
      if (path === '/api/me' && request.method === 'GET') {
        response = json({ email, owner: person.owner, permissions: person.owner ? { music: true, dance: true, journal: true } :
          { music: !!person.friend.music, dance: !!person.friend.dance, journal: !!person.friend.journal } });
      } else if (path === '/api/posts' && request.method === 'GET') {
        const preview = url.searchParams.get('as');
        if (preview && !person.owner) fail(403, 'Owner access required');
        const viewer = preview ? await principal(env, normalizeEmail(preview)) : person;
        response = json({ posts: await listPosts(env, viewer) });
      } else if (/^\/api\/posts\/[a-z0-9-]+$/.test(path) && request.method === 'GET') {
        const id = path.split('/')[3];
        const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
        if (!post || !await canRead(env, person, post)) fail(404, 'Article not found');
        response = json(parsePost(post, true));
      } else if (path.startsWith('/api/admin/')) {
        if (!person.owner) fail(403, 'Owner access required');
        response = await admin(request, env, path);
      } else if (path.startsWith('/api/media/') && request.method === 'GET') {
        const parts = path.split('/');
        const id = parts[3], file = parts[4];
        if (parts.length !== 5 || !ID.test(id || '') || !FILE.test(file || '')) fail(404, 'Media not found');
        const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
        if (!post || !await canRead(env, person, post) || !JSON.parse(post.media).some(m => m.file === file)) fail(404, 'Media not found');
        response = await readMedia(request, env, id, file);
      } else if (path.startsWith('/api/')) {
        fail(404, 'Not found');
      } else if (['/', '/index.html', '/app.js', '/style.css'].includes(path) && ['GET', 'HEAD'].includes(request.method)) {
        response = await env.ASSETS.fetch(request);
      } else fail(404, 'Not found');
    } catch (error) {
      response = json({ error: error instanceof HTTPError ? error.message : 'Request could not be completed' }, error instanceof HTTPError ? error.status : 500);
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Vary', 'Cookie, Cf-Access-Jwt-Assertion');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('Content-Security-Policy', CSP);
    return new Response(response.body, { status: response.status, headers });
  };
}

async function admin(request, env, path) {
  if (path === '/api/admin/friends' && request.method === 'GET') {
    return json({ friends: (await env.DB.prepare('SELECT * FROM friends ORDER BY name, email').all()).results });
  }
  if (path === '/api/admin/friends' && request.method === 'PUT') {
    const input = await readJSON(request);
    const email = normalizeEmail(input?.email);
    if (email === normalizeEmail(env.OWNER_EMAIL)) fail(400, 'Owner permissions cannot be edited');
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 ||
        ['active', 'music', 'dance', 'journal'].some(k => typeof input[k] !== 'boolean')) fail(400, 'Invalid friend');
    await env.DB.prepare('INSERT INTO friends (email, name, active, music, dance, journal) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name=excluded.name, active=excluded.active, music=excluded.music, dance=excluded.dance, journal=excluded.journal')
      .bind(email, input.name.trim(), +input.active, +input.music, +input.dance, +input.journal).run();
    return json({ saved: true });
  }
  if (path === '/api/admin/posts' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM posts ORDER BY updated_at DESC').all();
    const posts = [];
    for (const post of results) posts.push({ ...parsePost(post, true), readers: (await env.DB.prepare('SELECT email FROM readers WHERE post_id = ?').bind(post.id).all()).results.map(r => r.email) });
    return json({ posts });
  }
  const match = path.match(/^\/api\/admin\/posts\/([a-z0-9-]+)$/);
  if (match && request.method === 'PUT') {
    const id = match[1];
    if (!ID.test(id)) fail(400, 'Invalid article ID');
    const post = validatePost(await readJSON(request));
    const statements = [env.DB.prepare('INSERT INTO posts (id, section, visibility, variants, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET section=excluded.section, visibility=excluded.visibility, variants=excluded.variants, updated_at=excluded.updated_at')
      .bind(id, post.section, post.visibility, JSON.stringify(post.variants), new Date().toISOString()), env.DB.prepare('DELETE FROM readers WHERE post_id = ?').bind(id)];
    for (const email of post.readers) {
      if (!await env.DB.prepare('SELECT email FROM friends WHERE email = ? AND active = 1').bind(email).first()) fail(400, 'Reader is not an active friend');
      statements.push(env.DB.prepare('INSERT INTO readers (post_id, email) VALUES (?, ?)').bind(id, email));
    }
    await env.DB.batch(statements); // D1 batch is transactional: text and grants change together.
    return json({ saved: true });
  }
  const media = path.match(/^\/api\/admin\/posts\/([a-z0-9-]+)\/media\/([a-zA-Z0-9_.-]+)$/);
  if (media && request.method === 'PUT') {
    const [, id, file] = media;
    if (!ID.test(id) || !FILE.test(file)) fail(400, 'Invalid media path');
    const type = request.headers.get('Content-Type');
    const length = Number(request.headers.get('Content-Length'));
    if (!TYPES.has(type)) fail(415, 'Unsupported media type');
    if (!Number.isInteger(length) || length <= 0 || length > MEDIA_LIMIT) fail(413, 'Media must be between 1 byte and 50 MiB');
    const post = await env.DB.prepare('SELECT media FROM posts WHERE id = ?').bind(id).first();
    if (!post) fail(404, 'Article not found');
    const existing = JSON.parse(post.media);
    // New names only: replacing bytes cannot silently change content already shared.
    if (existing.some(m => m.file === file)) fail(409, 'Use a new filename');
    await env.MEDIA.put(`posts/${id}/${file}`, request.body, { httpMetadata: { contentType: type } });
    await env.DB.prepare("UPDATE posts SET media = json_insert(media, '$[#]', json(?)) WHERE id = ?")
      .bind(JSON.stringify({ file, type }), id).run();
    return json({ saved: true });
  }
  fail(404, 'Not found');
}

async function readMedia(request, env, id, file) {
  const key = `posts/${id}/${file}`;
  const head = await env.MEDIA.head(key);
  if (!head) fail(404, 'Media not found');
  let range;
  const raw = request.headers.get('Range');
  if (raw) {
    const match = raw.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, head.size - Number(match[2]));
    const end = match[1] ? (match[2] ? Math.min(Number(match[2]), head.size - 1) : head.size - 1) : head.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= head.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
    range = { offset: start, length: end - start + 1 };
  }
  const object = await env.MEDIA.get(key, range ? { range } : {});
  if (!object) fail(404, 'Media not found');
  const type = object.httpMetadata?.contentType;
  if (!TYPES.has(type)) fail(404, 'Media not found');
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(range ? range.length : head.size) };
  if (range) headers['Content-Range'] = `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`;
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

export default { fetch: createHandler() };
