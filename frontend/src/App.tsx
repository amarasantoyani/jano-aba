import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./lib/api";
import type { AuthUser } from "./lib/api";
import "./App.css";
import PatientsPage from "./pages/PatientsPage";

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function restoreSession() {
      try {
        const data = await api<{ user: AuthUser }>("/auth/me", {
          signal: controller.signal
        });

        if (!controller.signal.aborted) {
          setUser(data.user);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
        } else {
          setInitializationError(
            "Não foi possível conectar ao sistema. Tente novamente."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => controller.abort();
  }, [retryCount]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    setActionError("");
    setSubmitting(true);

    try {
      const data = await api<{ user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(formData.get("email") ?? "").trim(),
          password: String(formData.get("password") ?? "")
        })
      });

      setUser(data.user);
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível conectar ao sistema."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    if (submitting) {
      return;
    }

    setActionError("");
    setSubmitting(true);

    try {
      await api<void>("/auth/logout", {
        method: "POST"
      });

      setUser(null);
    } catch {
      setActionError("Não foi possível sair. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function retryConnection() {
    setInitializationError("");
    setLoading(true);
    setRetryCount((current) => current + 1);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="container header-content">
          <span className="brand">Jano ABA</span>

          <div className="header-actions">
            {user && (
              <button
                className="button button-secondary"
                type="button"
                onClick={handleLogout}
                disabled={submitting}
              >
                {submitting ? "Saindo..." : "Sair"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container main-content">
        {loading ? (
          <p role="status">Carregando...</p>
        ) : initializationError ? (
          <div className="auth-panel">
            <p className="feedback-error" role="alert">
              {initializationError}
            </p>

            <button
              className="button"
              type="button"
              onClick={retryConnection}
            >
              Tentar novamente
            </button>
          </div>
        ) : user ? (
          <section aria-labelledby="welcome-title">
            <p className="eyebrow">
              {user.role === "ADMIN" ? "Administração" : "Atendimentos"}
            </p>

            <h1 id="welcome-title">Olá, {user.name}</h1>

            <p className="page-description">
              Acompanhe pacientes, programas terapêuticos e sessões.
            </p>
            <PatientsPage key={user.id} user={user} />

            {actionError && (
              <p className="feedback-error" role="alert">
                {actionError}
              </p>
            )}
          </section>
        ) : (
          <section className="auth-panel" aria-labelledby="login-title">
            <p className="eyebrow">Acompanhamento terapêutico</p>
            <h1 id="login-title">Entre na sua conta</h1>

            <form className="auth-form" onSubmit={handleLogin}>
              <div className="form-field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={254}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-field">
                <label htmlFor="password">Senha</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                />
              </div>

              {actionError && (
                <p className="feedback-error" role="alert">
                  {actionError}
                </p>
              )}

              <button
                className="button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </section>
        )}

      </main>
    </div>
  );
}

export default App;