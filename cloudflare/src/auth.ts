import type { Env } from './types';

// JWT HS256 signed/verified with the Web Crypto API (crypto.subtle).
// No Node crypto dependency. The secret comes from env.JWT_SECRET.

const enc = new TextEncoder();
const dec = new TextDecoder();

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

function b64urlEncode(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
  const padded = b64 + (pad ? '='.repeat(pad) : '');
  const bytes = new Uint8Array((padded.length / 4) * 3 - pad);
  let p = 0;
  for (let i = 0; i < padded.length; i += 4) {
    // 填充只可能出现在最后一组：pad>=2 时最后一组后两字符为填充，pad==1 时最后一字符为填充。
    const lastGroup = i === padded.length - 4;
    const c0 = B64.indexOf(padded[i]);
    const c1 = B64.indexOf(padded[i + 1]);
    const c2 = pad >= 2 && lastGroup ? 0 : B64.indexOf(padded[i + 2]);
    const c3 = pad >= 1 && lastGroup ? 0 : B64.indexOf(padded[i + 3]);
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    bytes[p++] = (n >> 16) & 255;
    if (p < bytes.length) bytes[p++] = (n >> 8) & 255;
    if (p < bytes.length) bytes[p++] = n & 255;
  }
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export interface JwtPayload {
  sub: string;
  exp: number;
  [key: string]: unknown;
}

export async function signToken(secret: string, payload: JwtPayload): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const data = `${h}.${p}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64urlEncode(new Uint8Array(sig))}`;
}

// Returns the decoded payload if signature is valid AND not expired, otherwise null.
export async function verifyToken(secret: string, token: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(s), enc.encode(data));
  if (!ok) return null;
  let payload: JwtPayload;
  try {
    payload = JSON.parse(dec.decode(b64urlDecode(p))) as JwtPayload;
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
  return payload;
}
