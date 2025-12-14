import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creditAmount, setCreditAmount] = useState("10");
  const [maxUses, setMaxUses] = useState("1");

  const isAuthed = Boolean(session?.user);
  const isAdmin = Boolean(session?.user?.isAdmin);

  async function fetchKeys() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/keys");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Ошибка при загрузке ключей");
      } else {
        setKeys(data.keys || []);
      }
    } catch (e) {
      console.error(e);
      setError("Ошибка сети при загрузке ключей");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthed && isAdmin) {
      fetchKeys();
    }
  }, [isAuthed, isAdmin]);

  async function handleCreateKey() {
    setError("");

    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditAmount, maxUses }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Ошибка при создании ключа");
      } else {
        setKeys((prev) => [data.key, ...prev]);
      }
    } catch (e) {
      console.error(e);
      setError("Ошибка сети при создании ключа");
    }
  }

  if (status === "loading") {
    return <div className="app-shell">Загрузка...</div>;
  }

  if (!isAuthed) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <div className="main-inner">
            <div className="card">
              <div className="card-inner stack-v">
                <div className="card-title">Админ-панель HydraAI</div>
                <div className="card-subtitle">
                  Войдите через Google с админ-аккаунта.
                </div>
                <button className="btn" onClick={() => signIn("google")}>
                  Войти через Google
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <div className="main-inner">
            <div className="card">
              <div className="card-inner stack-v">
                <div className="card-title">Админ-панель HydraAI</div>
                <div className="card-subtitle">
                  У вашего аккаунта нет прав администратора.
                </div>
                <button className="btn-ghost" onClick={() => signOut()}>
                  Выйти
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
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
              <div className="logo-text-main">HYDRAAI ADMIN</div>
              <div className="logo-text-sub">KEY MANAGEMENT</div>
            </div>
          </div>
          <div className="app-header-right">
            <span className="tag-admin">ADMIN</span>
            <button
              className="btn-ghost text-xs"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Назад в чат
            </button>
            <button className="btn-ghost" onClick={() => signOut()}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-inner">
          <section className="card">
            <div className="card-inner stack-v">
              <div className="card-title-row">
                <div>
                  <div className="card-title-strong">Создание ключей</div>
                  <div className="card-subtitle">
                    Выдавайте коды пополнения, задавая сколько запросов и
                    сколько активаций даёт каждый код.
                  </div>
                </div>
              </div>

              <div className="stack-h">
                <div className="stack-v-tight" style={{ flex: 1 }}>
                  <label className="text-xs text-muted">
                    Сколько запросов даёт ключ
                  </label>
                  <input
                    className="input-inline"
                    type="number"
                    min="1"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                  />
                </div>
                <div className="stack-v-tight" style={{ flex: 1 }}>
                  <label className="text-xs text-muted">
                    Сколько раз ключ можно активировать
                  </label>
                  <input
                    className="input-inline"
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                  />
                </div>
                <button className="btn" onClick={handleCreateKey}>
                  Создать ключ
                </button>
              </div>

              {error && <div className="text-xs text-danger">{error}</div>}
            </div>
          </section>

          <aside className="card">
            <div className="card-inner stack-v">
              <div className="card-title-row">
                <div>
                  <div className="card-title-strong">Последние ключи</div>
                  <div className="card-subtitle">
                    Скопируйте и раздайте пользователям коды. Колонка
                    "Осталось" показывает число оставшихся активаций.
                  </div>
                </div>
                <div className="stack-h">
                  <span className="status-dot" />
                  <span className="text-xs text-muted">
                    {loading ? "Обновление..." : "Онлайн"}
                  </span>
                </div>
              </div>

              <div className="stack-v-tight">
                {keys.length === 0 ? (
                  <div className="text-xs text-muted">
                    Ключи ещё не созданы.
                  </div>
                ) : (
                  keys.map((k) => (
                    <div
                      key={k.id}
                      className="stack-h"
                      style={{ justifyContent: "space-between" }}
                    >
                      <div>
                        <div className="text-sm">{k.code}</div>
                        <div className="text-xs text-muted">
                          +{k.credit_amount} запросов · Осталось: {" "}
                          {k.remaining_uses}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
