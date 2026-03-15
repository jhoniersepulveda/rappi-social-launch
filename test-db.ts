import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import pg from 'pg'

const url = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '')
console.log('Connecting to:', url.split('@')[1])

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

pool.query('SELECT 1 as ok')
  .then(r => { console.log('✓ pg conectado:', r.rows); process.exit(0) })
  .catch(e => { console.error('✗ pg falló:', e.message, e.code); process.exit(1) })
