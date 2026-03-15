import pg from 'pg'

let _pool: pg.Pool | null = null

function getPool(): pg.Pool {
  if (_pool) return _pool

  const connectionString = (process.env.DATABASE_URL || '')
    .replace('&channel_binding=require', '')
    .replace('?channel_binding=require', '')

  _pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  return _pool
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(text: string, params?: any[]) {
  return getPool().query(text, params)
}
