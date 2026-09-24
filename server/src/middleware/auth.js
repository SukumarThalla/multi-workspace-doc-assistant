import { createRemoteJWKSet, jwtVerify } from 'jose';

// Supabase now signs session JWTs with an asymmetric key (ES256) by default.
// We verify against the project's published JWKS rather than a shared secret.
const JWKS = createRemoteJWKSet(new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

// Verifies the Supabase-issued JWT sent by the frontend and attaches req.userId.
// Every route past this point trusts req.userId — never trust a userId from the body/query.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
