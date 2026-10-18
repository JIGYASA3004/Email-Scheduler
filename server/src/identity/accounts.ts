import { pg } from '../infra/postgres';

export interface Account {
  id: string;
  email: string;
  full_name: string;
  picture: string | null;
}

export async function upsertGoogleAccount(p: {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}): Promise<Account> {
  const { rows } = await pg.query<Account>(
    `INSERT INTO account (google_sub, email, full_name, picture)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_sub) DO UPDATE
       SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, picture = EXCLUDED.picture
     RETURNING id, email, full_name, picture`,
    [p.sub, p.email, p.name ?? p.email, p.picture ?? null],
  );
  return rows[0];
}

export async function findAccount(id: string): Promise<Account | null> {
  const { rows } = await pg.query<Account>(
    'SELECT id, email, full_name, picture FROM account WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}
