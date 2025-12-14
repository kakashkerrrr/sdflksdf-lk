import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

function CreditsBadge({ credits }) {
  if (!credits) return null;
  return (
    <div className="badge-credit">
      Остаток: <span>{credits.remaining ?? 0}</span> / {credits.total ?? 0}
    </div>
  );
}

function ChatMessage({ role, content }) {
  const cls =
    role === "user"
      ? "chat-message user"
      : role === "assistant"
      ? "chat-message assistant"
      : "chat-message system";

  return <div className={cls}>{content}</div>;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState([
    {
      role: "system",
      content:
        "HydraAI: у вас есть 3 бесплатных запроса к Meta Llama. Введите вопрос, чтобы начать.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(session?.user?.credits || null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState("");

  const isAuthed = Boolean(session?.user);
  const isAdmin = Boolean(session?.user?.isAdmin);

  async function handleSend() {
    if (!input.trim() || loading) return;
    if (!isAuthed) {
      setError("Войдите через Google, чтобы использовать HydraAI");
      return;
    }

    setError("");
    setRedeemMsg("");
    const userText = input.trim();
    setInput("");

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userText },
      { role: "assistant", content: "HydraAI думает..." },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userText }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Ошибка при запросе к API");
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: data?.error || "Не удалось получить ответ от HydraAI.",
          };
          return copy;
        });
      } else {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: data.answer,
          };
          return copy;
        });
        if (data.credits) {
          setCredits(data.credits);
        }
      }
    } catch (e) {
      console.error(e);
      setError("Сетевая ошибка при обращении к HydraAI");
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Сетевая ошибка. Попробуйте ещё раз.",
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem() {
    if (!redeemCode.trim()) return;
    if (!isAuthed) {
      setError("Сначала войдите через Google");
      return;
    }

    setError("");
    setRedeemMsg("");

    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Ошибка при активации ключа");
      } else {
        setRedeemMsg(
          `Ключ активирован: добавлено ${data.added} запросов к вашему балансу.`
        );
        if (data.credits) {
          setCredits(data.credits);
        }
        setRedeemCode("");
      }
    } catch (e) {
      console.error(e);
      setError("Ошибка сети при активации ключа");
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="logo-mark">
            <div className="logo-circle">
              <div className="logo-tentacles" />
            </div>
            <div>
              <div className="logo-text-main">HYDRAAI</div>
              <div className="logo-text-sub">META POWERED GATEWAY</div>
            </div>
          </div>
          <div className="app-header-right">
            <CreditsBadge credits={credits || session?.user?.credits} />
            {isAdmin && (
              <button
                className="btn-ghost text-xs"
                onClick={() => {
                  window.location.href = "/admin";
                }}
              >
                Админ панель
              </button>
            )}
            {status === "loading" ? null : isAuthed ? (
              <button className="btn-ghost" onClick={() => signOut()}>
                Выйти
              </button>
            ) : (
              <button className="btn" onClick={() => signIn("google")}>
                Войти через Google
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-inner">
          <section className="card">
            <div className="card-inner stack-v">
              <div className="card-title-row">
                <div>
                  <div className="card-title">HydraAI чат</div>
                  <div className="card-subtitle">
                    3 бесплатных запроса к Meta Llama, потом пополнение через
                    специальные ключи.
                  </div>
                </div>
                <div className="chip">
                  <span className="chip-dot" />
                  Meta Llama 3.1 8B
                </div>
              </div>

              <div className="chat-window">
                <div className="chat-messages">
                  {messages.map((m, i) => (
                    <ChatMessage key={i} role={m.role} content={m.content} />
                  ))}
                </div>
                <div className="chat-input-row">
                  <textarea
                    placeholder={
                      isAuthed
                        ? "Спросите HydraAI о чём угодно..."
                        : "Войдите через Google, чтобы начать диалог"
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={loading || !isAuthed}
                  />
                  <button
                    className="btn"
                    onClick={handleSend}
                    disabled={loading || !isAuthed}
                  >
                    {loading ? "Отправка..." : "Спросить"}
                  </button>
                </div>
              </div>

              {error && <div className="text-xs text-danger">{error}</div>}
              {redeemMsg && (
                <div className="text-xs" style={{ color: "#7bffb8" }}>
                  {redeemMsg}
                </div>
              )}
            </div>
          </section>

          <aside className="card">
            <div className="card-inner stack-v">
              <div className="card-title-row">
                <div>
                  <div className="card-title-strong">Ключи пополнения</div>
                  <div className="card-subtitle">
                    Введите выданный администратором ключ, чтобы получить
                    дополнительные запросы.
                  </div>
                </div>
              </div>

              <div className="stack-v-tight">
                <label className="text-xs text-muted">Код ключа</label>
                <input
                  className="input"
                  placeholder="например: HYDRA-ABCD-EFGH-IJKL"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                />
              </div>

              <div className="stack-h" style={{ justifyContent: "space-between" }}>
                <span className="text-xs text-muted">
                  Ключи создаются администраторами HydraAI и могут выдавать
                  разные объёмы запросов.
                </span>
                <button className="btn-ghost" onClick={handleRedeem}>
                  Активировать
                </button>
              </div>

              <div className="separator" />

              <div className="stack-v-tight">
                <div className="text-xs text-muted">
                  Вход через Google обязателен для защиты лимитов запросов.
                </div>
                <div className="text-xs">
                  После первого входа на аккаунт автоматически начисляются
                  <strong> 3 бесплатных запроса</strong> к Meta Llama.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="footer">
        HydraAI · бесплатный шлюз к Meta Llama через ограниченное количество
        запросов. Администраторы могут выдавать дополнительные ключи.
      </footer>
    </div>
  );
}
