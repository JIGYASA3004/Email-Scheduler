import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { settings } from '../settings';

// Minimal signed-token + cookie helpers (avoids pulling in jwt / cookie-parser).

const mac = (data: string) => createHmac('sha256', settings.sessionSecret).update(data).digest('base64url');

export function seal(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString('base64url');
  return `${body}.${mac(body)}`;
}

export function unseal<T extends object>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { exp: number };
    return data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function writeCookie(res: Response, name: string, value: string, maxAgeSeconds: number): void {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: settings.appUrl.startsWith('https://'),
    maxAge: maxAgeSeconds * 1000,
    path: '/',
  });
}
