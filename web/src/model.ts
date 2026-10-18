// Shapes returned by / sent to the server API.

export interface Profile {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

export interface SenderBox {
  id: number;
  address: string;
  sentThisHour: number;
}

export interface SenderList {
  mailboxes: SenderBox[];
  maxPerHour: number;
  minGapMs: number;
}

export type DeliveryState = 'scheduled' | 'throttled' | 'sending' | 'sent' | 'failed';
export type FolderName = 'scheduled' | 'sent';

export interface DeliveryItem {
  id: string;
  recipient: string;
  subject: string;
  snippet: string;
  sender: string;
  state: DeliveryState;
  dueAt: string;
  sentAt: string | null;
  error: string | null;
  previewUrl: string | null;
}

export interface FolderPage {
  total: number;
  items: DeliveryItem[];
}

export type FolderTotals = Record<FolderName, number>;

export interface BatchPayload {
  mailboxId: number;
  subject: string;
  body: string;
  recipients: string[];
  startsAt: string | null;
  gapSeconds: number;
  hourlyCap: number | null;
}

export interface BatchReceipt {
  batchId: string;
  queued: number;
  replayed: boolean;
}
