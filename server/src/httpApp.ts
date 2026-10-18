import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { googleAuth } from './identity/google';
import { outbox } from './outbox/endpoints';

export function buildHttpApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/auth', googleAuth);
  app.use('/api', outbox);

  // In production the built SPA is served from the same origin as the API.
  const spa = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(spa)) {
    app.use(express.static(spa));
    app.get(/^\/(?!api|auth).*/, (_req, res) => res.sendFile(path.join(spa, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[http]', err);
    res.status(500).json({ error: 'Something went wrong on our side' });
  });
  return app;
}
