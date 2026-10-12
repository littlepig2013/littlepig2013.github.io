export class HTTPError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function normalizeEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new HTTPError(400, 'Invalid email');
  }
  return value.trim().toLowerCase();
}

function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('Invalid encoding');
  return Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

// No trust is placed in the unsigned email header or a browser-supplied identity.
export function createAuthenticator({ fetchFn = fetch, now = () => Date.now() } = {}) {
  let cache = null;
  return async function authenticate(request, env) {
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN || '') ||
        !env.ACCESS_AUD || env.ACCESS_AUD.startsWith('REPLACE') ||
        !env.OWNER_EMAIL || env.OWNER_EMAIL.startsWith('REPLACE')) {
      throw new HTTPError(503, 'Authentication is not configured');
    }
    const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!jwt) throw new HTTPError(401, 'Sign in required');
    if (jwt.length > 16384) throw new HTTPError(401, 'Invalid session');
    const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
    let header, payload, parts;
    try {
      parts = jwt.split('.');
      if (parts.length !== 3) throw new Error('Invalid token');
      header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
      payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
      const seconds = now() / 1000;
      if (header.alg !== 'RS256' || typeof header.kid !== 'string' ||
          payload.iss !== issuer || !Array.isArray(payload.aud) || !payload.aud.includes(env.ACCESS_AUD) ||
          !Number.isFinite(payload.exp) || payload.exp <= seconds ||
          (payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || payload.nbf > seconds))) {
        throw new Error('Invalid claims');
      }
    } catch { throw new HTTPError(401, 'Invalid session'); }
    if (!cache || cache.issuer !== issuer || cache.expires <= now()) {
      try {
        const response = await fetchFn(`${issuer}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Key service unavailable');
        const { keys } = await response.json();
        if (!Array.isArray(keys)) throw new Error('Invalid key set');
        cache = { issuer, keys, expires: now() + 60000 };
      } catch { throw new HTTPError(503, 'Sign-in verification is temporarily unavailable'); }
    }
    try {
      const jwk = cache.keys.find(k => k.kid === header.kid && k.kty === 'RSA');
      if (!jwk) throw new Error('Unknown key');
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) {
        throw new Error('Invalid signature');
      }
      return normalizeEmail(payload.email);
    } catch { throw new HTTPError(401, 'Invalid session'); }
  };
}

export const authenticate = createAuthenticator();
