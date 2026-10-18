// Centralised, typed view over process.env. Everything tunable lives here.

function text(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  return n;
}

const secret = text('SESSION_SECRET', '');
if (!secret) console.warn('[config] SESSION_SECRET is empty, using an insecure development secret');

export const settings = {
  port: int('PORT', 4100),
  appUrl: text('APP_URL', 'http://localhost:5180').replace(/\/$/, ''),
  sessionSecret: secret || 'dev-only-insecure-secret',

  databaseUrl: text('DATABASE_URL', 'postgres://mailer:mailer@localhost:5442/mailer'),
  redisUrl: text('REDIS_URL', 'redis://localhost:6390'),

  google: {
    clientId: text('GOOGLE_CLIENT_ID', ''),
    clientSecret: text('GOOGLE_CLIENT_SECRET', ''),
    redirectUri: text('GOOGLE_REDIRECT_URI', 'http://localhost:5180/auth/google/callback'),
  },

  delivery: {
    queueName: 'outbound-mail',
    concurrency: Math.max(1, int('WORKER_CONCURRENCY', 5)),
    minGapMs: int('MIN_SEND_GAP_MS', 2000),
    maxPerHourPerSender: Math.max(1, int('MAX_EMAILS_PER_HOUR_PER_SENDER', 200)),
    attempts: Math.max(1, int('SEND_ATTEMPTS', 3)),
    // a 'sending' row older than this is considered abandoned by a crashed worker
    claimTtlMs: 60_000,
  },

  ethereal: {
    count: int('ETHEREAL_SENDER_COUNT', 3),
    presets: text('ETHEREAL_ACCOUNTS', ''),
  },
};
