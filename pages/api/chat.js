import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { pool } from "../../lib/db";
import { callMetaChat } from "../../lib/sambanova";
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

  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Некорректный запрос" });
  }

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [
      session.user.email.toLowerCase(),
    ]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(403).json({ error: "Пользователь не найден" });
    }

    const remaining = getRemainingCredits(user);

    if (remaining <= 0) {
      return res
        .status(403)
        .json({ error: "Лимит запросов исчерпан", remaining: 0 });
    }

    let metaResponse;

    try {
      metaResponse = await callMetaChat({
        messages: [
          {
            role: "system",
            content: "You are HydraAI, a helpful assistant.",
          },
          { role: "user", content: prompt },
        ],
      });
    } catch (metaError) {
      console.error("Meta API error", metaError);
      return res.status(502).json({
        error: "Ошибка при обращении к Meta API. Попробуйте ещё раз позже.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        "UPDATE users SET used_credits = used_credits + 1 WHERE id = $1",
        [user.id]
      );

      await client.query(
        "INSERT INTO request_logs (user_id, prompt, response_preview) VALUES ($1, $2, $3)",
        [user.id, prompt, metaResponse.content.slice(0, 500)]
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("DB error while logging request", e);
    } finally {
      client.release();
    }

    const updatedRes = await pool.query(
      "SELECT total_credits, used_credits FROM users WHERE id = $1",
      [user.id]
    );
    const updatedUser = updatedRes.rows[0];
    const newRemaining = getRemainingCredits(updatedUser);

    return res.status(200).json({
      answer: metaResponse.content,
      credits: {
        total: updatedUser.total_credits,
        used: updatedUser.used_credits,
        remaining: newRemaining,
      },
    });
  } catch (e) {
    console.error("Chat API error", e);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
}
