import type { BatchPayload, BatchReceipt, FolderName, FolderPage, FolderTotals, Profile, SenderList } from '../model';
import { request } from './request';

export const server = {
  whoAmI: () => request<Profile>('/api/me'),
  signOut: () => request<void>('/auth/logout', { method: 'POST' }),
  senders: () => request<SenderList>('/api/mailboxes'),
  totals: () => request<FolderTotals>('/api/totals'),
  folder: (name: FolderName, search: string) =>
    request<FolderPage>(`/api/folders/${name}?limit=100${search ? `&q=${encodeURIComponent(search)}` : ''}`),
  createBatch: (payload: BatchPayload, idempotencyKey: string) =>
    request<BatchReceipt>('/api/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
};

export const GOOGLE_SIGN_IN_URL = `${import.meta.env.VITE_API_BASE ?? ''}/auth/google`;
