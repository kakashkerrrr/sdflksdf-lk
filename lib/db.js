import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Оставляем явную ошибка при отсутствии конфигурации БД
  throw new Error("DATABASE_URL is not set. Configure PostgreSQL connection string in your environment.");
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      provider VARCHAR(32) NOT NULL,
      provider_id VARCHAR(128) NOT NULL,
      email TEXT UNIQUE,
      name TEXT,
      image TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      total_credits INTEGER NOT NULL DEFAULT 3,
      used_credits INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      credit_amount INTEGER NOT NULL,
      remaining_uses INTEGER NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      prompt TEXT NOT NULL,
      response_preview TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

ensureSchema().catch((err) => {
  console.error("Failed to ensure DB schema", err);
});
