import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { pool } from "../../lib/db";
import { getRemainingCredits } from "../../lib/user";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.email) {
    return res.status(401).json({ error: "Требуется вход через Google" });
  }

  const { code } = req.body || {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Укажите ключ" });
  }

  const normalized = code.trim().toUpperCase();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const keyRes = await client.query(
      "SELECT * FROM api_keys WHERE code = $1 FOR UPDATE",
      [normalized]
    );
    const key = keyRes.rows[0];

    if (!key) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Ключ не найден" });
    }

    if (key.remaining_uses <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "У этого ключа закончились активации" });
    }

    const userRes = await client.query(
      "SELECT * FROM users WHERE email = $1 FOR UPDATE",
      [session.user.email.toLowerCase()]
    );
    const user = userRes.rows[0];

    if (!user) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Пользователь не найден" });
    }

    await client.query(
      "UPDATE api_keys SET remaining_uses = remaining_uses - 1 WHERE id = $1",
      [key.id]
    );

    await client.query(
      "UPDATE users SET total_credits = total_credits + $1 WHERE id = $2",
      [key.credit_amount, user.id]
    );

    await client.query("COMMIT");

    const updatedRes = await pool.query(
      "SELECT total_credits, used_credits FROM users WHERE id = $1",
      [user.id]
    );
    const updatedUser = updatedRes.rows[0];
    const remaining = getRemainingCredits(updatedUser);

    return res.status(200).json({
      added: key.credit_amount,
      credits: {
        total: updatedUser.total_credits,
        used: updatedUser.used_credits,
        remaining,
      },
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Redeem API error", e);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  } finally {
    client.release();
  }
}
