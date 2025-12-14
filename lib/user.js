import { pool } from "./db";

const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function upsertUserFromProfile(profile) {
  const email = profile.email ? profile.email.toLowerCase() : null;
  const providerId = profile.id || profile.sub || profile.email || email;
  const isAdmin = email && adminEmails.includes(email);

  const result = await pool.query(
    `
      INSERT INTO users (provider, provider_id, email, name, image, is_admin)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        image = EXCLUDED.image,
        is_admin = EXCLUDED.is_admin
      RETURNING *
    `,
    ["google", providerId, email, profile.name, profile.image, Boolean(isAdmin)]
  );

  return result.rows[0];
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  return result.rows[0] || null;
}

export function getRemainingCredits(userRow) {
  if (!userRow) return 0;
  return Math.max(0, (userRow.total_credits || 0) - (userRow.used_credits || 0));
}

export async function addCredits(userId, amount) {
  if (!userId || !amount || amount <= 0) return;
  await pool.query(
    "UPDATE users SET total_credits = total_credits + $1 WHERE id = $2",
    [amount, userId]
  );
}

export async function incrementUsedCredit(userId) {
  if (!userId) return;
  await pool.query(
    "UPDATE users SET used_credits = used_credits + 1 WHERE id = $1",
    [userId]
  );
}
