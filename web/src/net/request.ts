const BASE = import.meta.env.VITE_API_BASE ?? '';

export class RequestFailure extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      ...init,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new RequestFailure(0, 'Cannot reach the server. Is the backend running?');
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new RequestFailure(res.status, detail?.error ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
