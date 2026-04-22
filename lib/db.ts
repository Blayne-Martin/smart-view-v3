import postgres from 'postgres'

declare global {
  // eslint-disable-next-line no-var
  var _sql: postgres.Sql | undefined
}

function createDb() {
  return postgres(process.env.DATABASE_URL!, {
    ssl: 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  })
}

// Reuse connection across hot-reloads in development
export const sql = globalThis._sql ?? createDb()
if (process.env.NODE_ENV !== 'production') globalThis._sql = sql
