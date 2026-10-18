import { randomBytes } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { settings } from '../settings';
import { findAccount, upsertGoogleAccount } from './accounts';
import { readCookie, seal, unseal, writeCookie } from './seal';

const SESSION = 'sid';
const STATE = 'g_state';
const WEEK = 7 * 24 * 3600;

export const googleAuth = Router();

googleAuth.get('/google', (_req, res) => {
  if (!settings.google.clientId) {
    res.status(503).send('Google OAuth is not configured (GOOGLE_CLIENT_ID missing).');
    return;
  }
  const state = randomBytes(16).toString('hex');
  writeCookie(res, STATE, state, 600);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: settings.google.clientId,
    redirect_uri: settings.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  res.redirect(url.toString());
});

googleAuth.get('/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  res.clearCookie(STATE, { path: '/' });
  if (!code || !state || state !== readCookie(req, STATE)) {
    res.redirect(`${settings.appUrl}/?login=failed`);
    return;
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: settings.google.clientId,
      client_secret: settings.google.clientSecret,
      redirect_uri: settings.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    console.error('[auth] token exchange failed', tokenRes.status, await tokenRes.text());
    res.redirect(`${settings.appUrl}/?login=failed`);
    return;
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${access_token}` },
  });
  const profile = (await profileRes.json()) as { sub: string; email: string; name?: string; picture?: string };
  if (!profileRes.ok || !profile.sub || !profile.email) {
    res.redirect(`${settings.appUrl}/?login=failed`);
    return;
  }

  const account = await upsertGoogleAccount(profile);
  writeCookie(res, SESSION, seal({ uid: account.id }, WEEK), WEEK);
  res.redirect(`${settings.appUrl}/#/scheduled`);
});

googleAuth.post('/logout', (_req, res) => {
  res.clearCookie(SESSION, { path: '/' });
  res.status(204).end();
});

/** Rejects requests without a valid session; exposes the user id as res.locals.uid. */
export async function signedIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = unseal<{ uid: string }>(readCookie(req, SESSION));
  if (!session || !(await findAccount(session.uid))) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  res.locals.uid = session.uid;
  next();
}

export const uidOf = (res: Response): string => res.locals.uid as string;
