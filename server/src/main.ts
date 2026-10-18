import type { Server } from 'node:http';
import type { Worker } from 'bullmq';
import { settings } from './settings';
import { applySchema, pg } from './infra/postgres';
import { kv } from './infra/kv';
import { provisionMailboxes } from './delivery/mailboxes';
import { deliveryQueue } from './delivery/queue';
import { reconcile, startWorker } from './delivery/runner';
import { buildHttpApp } from './httpApp';

// One binary, two roles: `--role=api`, `--role=worker`, or both (default).
type Role = 'api' | 'worker' | 'all';
const role = (process.argv.find((a) => a.startsWith('--role='))?.split('=')[1] ?? process.env.ROLE ?? 'all') as Role;

async function boot() {
  await applySchema();
  await provisionMailboxes();

  let server: Server | undefined;
  let worker: Worker | undefined;

  if (role === 'api' || role === 'all') {
    server = buildHttpApp().listen(settings.port, (err?: Error) => {
      if (err) {
        console.error(`[api] cannot listen on port ${settings.port}: ${err.message}`);
        process.exit(1);
      }
      console.log(`[api] http://localhost:${settings.port}`);
    });
  }
  if (role === 'worker' || role === 'all') {
    worker = startWorker();
    await reconcile();
  }

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[${role}] ${signal} received, shutting down gracefully`);
    server?.close();
    await worker?.close(); // waits for in-flight sends to finish
    await deliveryQueue.close();
    await kv.quit();
    await pg.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));
}

boot().catch((err) => {
  console.error('[boot] fatal', err);
  process.exit(1);
});
