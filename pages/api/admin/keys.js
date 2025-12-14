import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { pool } from "../../../lib/db";

function isAdminUser(session) {
  return Boolean(session?.user?.isAdmin);
}

function generateKeyCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HYDRA-${part()}-${part()}-${part()}`;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.email) {
    return res.status(401).json({ error: "Требуется вход через Google" });
  }

  if (!isAdminUser(session)) {
    return res.status(403).json({ error: "Доступ только для администраторов" });
  }

  if (req.method === "GET") {
    try {
      const result = await pool.query(
        "SELECT id, code, credit_amount, remaining_uses, created_at FROM api_keys ORDER BY created_at DESC LIMIT 100"
      );
      return res.status(200).json({ keys: result.rows });
    } catch (e) {
      console.error("Admin list keys error", e);
      return res.status(500).json({ error: "Ошибка при получении ключей" });
    }
  }

  if (req.method === "POST") {
    const { creditAmount, maxUses } = req.body || {};

    const amount = parseInt(creditAmount, 10);
    const uses = parseInt(maxUses, 10);

    if (!amount || amount <= 0 || !uses || uses <= 0) {
      return res
        .status(400)
        .json({ error: "Укажите положительные значения для запросов и активаций" });
    }

    const code = generateKeyCode();

    try {
      const userRes = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [session.user.email.toLowerCase()]
      );
      const dbUser = userRes.rows[0];

      const insertRes = await pool.query(
        "INSERT INTO api_keys (code, credit_amount, remaining_uses, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
        [code, amount, uses, dbUser?.id || null]
      );

      return res.status(201).json({ key: insertRes.rows[0] });
    } catch (e) {
      console.error("Admin create key error", e);
      return res.status(500).json({ error: "Ошибка при создании ключа" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
