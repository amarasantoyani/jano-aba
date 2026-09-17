import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import type { AuthUser } from "../lib/api";

interface SessionProgram {
  id: string;
  name: string;
  status: string;
  objectives: {
    id: string;
    description: string;
  }[];
}

interface TherapySession {
  id: string;
  occurredAt: string;
  authorization: {
    therapist: {
      id: string;
      name: string;
    };
  };
  records: {
    id: string;
    achieved: boolean;
    objective: {
      id: string;
      description: string;
      programId: string;
    };
  }[];
}

interface PatientSessionsProps {
  patientId: string;
  user: AuthUser;
  programs: SessionProgram[];
}

export default function PatientSessions({
  patientId,
  user,
  programs
}: PatientSessionsProps) {
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const activePrograms = programs.filter(
    (program) => program.status === "IN_PROGRESS"
  );

  const hasObjectives = activePrograms.some(
    (program) => program.objectives.length > 0
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError("");

      try {
        const data = await api<{ sessions: TherapySession[] }>(
          `/sessions/patient/${patientId}?page=${page}`,
          { signal: controller.signal }
        );

        if (!controller.signal.aborted) {
          setSessions(data.sessions);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setSessions([]);
          setLoadError(
            error instanceof ApiError
              ? error.message
              : "Não foi possível carregar o histórico."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [patientId, page, refreshCount]);

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    const records = activePrograms.flatMap((program) =>
      program.objectives.flatMap((objective) => {
        const result = data.get(`objective-${objective.id}`);

        if (result !== "true" && result !== "false") {
          return [];
        }

        return [{
          objectiveId: objective.id,
          achieved: result === "true"
        }];
      })
    );

    setFormError("");
    setSuccessMessage("");

    if (records.length === 0 || records.length > 100) {
      setFormError("Registre o resultado de 1 a 100 objetivos.");
      return;
    }

    const dateInput = String(data.get("occurredAt") ?? "");
    const occurredAt = dateInput ? new Date(dateInput) : new Date();

    if (Number.isNaN(occurredAt.getTime())) {
      setFormError("Informe uma data e hora válidas.");
      return;
    }

    setSaving(true);

    try {
      await api<unknown>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          occurredAt: occurredAt.toISOString(),
          records
        })
      });

      form.reset();
      setSuccessMessage("Atendimento registrado.");
      setPage(1);
      setRefreshCount((current) => current + 1);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível registrar o atendimento."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="sessions-title">
      <h2 id="sessions-title">Sessões</h2>

      {user.role === "THERAPIST" && (
        <section className="panel" aria-labelledby="new-session-title">
          <h3 id="new-session-title">Registrar atendimento</h3>

          {!hasObjectives ? (
            <p>Não há objetivos de programas em andamento para registrar.</p>
          ) : (
            <form className="session-form" onSubmit={handleCreateSession}>
              <div className="form-field">
                <label htmlFor="session-date">
                  Data e hora do atendimento
                </label>
                <input
                  id="session-date"
                  name="occurredAt"
                  type="datetime-local"
                  step="1"
                  disabled={saving}
                  aria-describedby="session-date-hint"
                />
                <small id="session-date-hint" className="field-hint">
                  Horário local do seu dispositivo. Deixe vazio para
                  registrar o horário atual.
                </small>
              </div>

              <p>
                Selecione o resultado somente dos objetivos trabalhados.
              </p>

              {activePrograms.map((program) => (
                <fieldset
                  className="objective-fieldset"
                  key={program.id}
                  disabled={saving}
                >
                  <legend>{program.name}</legend>

                  {program.objectives.map((objective) => (
                    <div className="form-field" key={objective.id}>
                      <label htmlFor={`result-${objective.id}`}>
                        {objective.description}
                      </label>

                      <select
                        id={`result-${objective.id}`}
                        name={`objective-${objective.id}`}
                        defaultValue=""
                      >
                        <option value="">Não trabalhado</option>
                        <option value="true">Realizou</option>
                        <option value="false">Não realizou</option>
                      </select>
                    </div>
                  ))}
                </fieldset>
              ))}

              <p className="field-hint">
                Confira os resultados antes de salvar. Esta versão não
                permite editar atendimentos registrados.
              </p>

              {formError && (
                <p className="feedback-error" role="alert">{formError}</p>
              )}

              {successMessage && (
                <p className="feedback-success" role="status">
                  {successMessage}
                </p>
              )}

              <button className="button" type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar atendimento"}
              </button>
            </form>
          )}
        </section>
      )}

      <div className="section-toolbar">
        <h3>Histórico de atendimentos</h3>
        <button
          className="button button-secondary"
          type="button"
          disabled={loading}
          onClick={() => setRefreshCount((current) => current + 1)}
        >
          Atualizar histórico
        </button>
      </div>

      {loading ? (
        <p role="status">Carregando histórico...</p>
      ) : loadError ? (
        <p className="feedback-error" role="alert">{loadError}</p>
      ) : sessions.length === 0 ? (
        <p>Nenhum atendimento nesta página.</p>
      ) : (
        sessions.map((session) => (
          <article className="panel" key={session.id}>
            <h3>
              {new Date(session.occurredAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo"
              })}
              {" — horário de Brasília"}
            </h3>

            <p>Terapeuta: {session.authorization.therapist.name}</p>

            <ul className="objective-list">
              {session.records.map((record) => (
                <li key={record.id}>
                  {record.objective.description}
                  {" — "}
                  <strong>
                    {record.achieved ? "Realizou" : "Não realizou"}
                  </strong>
                </li>
              ))}
            </ul>
          </article>
        ))
      )}

      <nav className="pagination" aria-label="Paginação de atendimentos">
        <button
          className="button button-secondary"
          type="button"
          disabled={loading || page === 1}
          onClick={() => setPage((current) => current - 1)}
        >
          Anterior
        </button>

        <span aria-live="polite">Página {page}</span>

        <button
          className="button button-secondary"
          type="button"
          disabled={loading || Boolean(loadError) || sessions.length < 20}
          onClick={() => setPage((current) => current + 1)}
        >
          Próxima
        </button>
      </nav>
    </section>
  );
}