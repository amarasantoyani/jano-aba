import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../lib/api";

interface Therapist {
  id: string;
  name: string;
  email: string;
}

interface Authorization {
  id: string;
  therapistId: string;
  grantedAt: string;
  revokedAt: string | null;
  therapist: Therapist;
}

export default function PatientAuthorizations({
  patientId
}: {
  patientId: string;
}) {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError("");

      try {
        const [therapistData, authorizationData] = await Promise.all([
          api<{ therapists: Therapist[] }>("/therapists", {
            signal: controller.signal
          }),
          api<{ authorizations: Authorization[] }>(
            `/authorizations/patient/${patientId}`,
            { signal: controller.signal }
          )
        ]);

        if (!controller.signal.aborted) {
          setTherapists(therapistData.therapists);
          setAuthorizations(authorizationData.authorizations);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setTherapists([]);
          setAuthorizations([]);
          setLoadError(
            error instanceof ApiError
              ? error.message
              : "Não foi possível carregar as autorizações."
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
  }, [patientId, refreshCount]);

  async function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setSaving(true);
    setActionError("");

    try {
      await api<unknown>("/authorizations", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          therapistId: String(data.get("therapistId") ?? "")
        })
      });

      form.reset();
      setRefreshCount((current) => current + 1);
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível conceder a autorização."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(authorization: Authorization) {
    if (saving) return;

    if (
      !window.confirm(
        `Revogar o acesso de ${authorization.therapist.name}? O histórico será preservado.`
      )
    ) {
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      await api<unknown>(
        `/authorizations/${authorization.id}/revoke`,
        { method: "POST" }
      );

      setRefreshCount((current) => current + 1);
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível revogar a autorização."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="authorizations-title">
      <h2 id="authorizations-title">Autorizações de terapeutas</h2>

      {loading ? (
        <p role="status">Carregando autorizações...</p>
      ) : loadError ? (
        <>
          <p className="feedback-error" role="alert">{loadError}</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setRefreshCount((current) => current + 1)}
          >
            Tentar novamente
          </button>
        </>
      ) : (
        <>
          <form className="inline-form" onSubmit={handleGrant}>
            <div className="form-field">
              <label htmlFor="authorized-therapist">Terapeuta</label>
              <select
                id="authorized-therapist"
                name="therapistId"
                defaultValue=""
                required
                disabled={saving}
              >
                <option value="" disabled>Selecione um terapeuta</option>
                {therapists.map((therapist) => (
                  <option key={therapist.id} value={therapist.id}>
                    {therapist.name} — {therapist.email}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="button"
              type="submit"
              disabled={saving || therapists.length === 0}
            >
              Autorizar
            </button>
          </form>

          {actionError && (
            <p className="feedback-error" role="alert">{actionError}</p>
          )}

          <h3 className="subsection-title">Autorizações recentes</h3>
          <p className="field-hint">
            Até 100 registros mais recentes. Uma nova concessão preserva
            as autorizações anteriores.
          </p>

          {authorizations.length === 0 ? (
            <p>Nenhuma autorização registrada.</p>
          ) : (
            <ul className="authorization-list">
              {authorizations.map((authorization) => (
                <li key={authorization.id}>
                  <div>
                    <strong>{authorization.therapist.name}</strong>
                    <p>
                      {authorization.revokedAt ? "Revogada" : "Ativa"}
                      {" · Concedida em "}
                      {new Date(authorization.grantedAt).toLocaleString(
                        "pt-BR",
                        { timeZone: "America/Sao_Paulo" }
                      )}
                    </p>
                  </div>

                  {!authorization.revokedAt && (
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={saving}
                      onClick={() => void handleRevoke(authorization)}
                    >
                      Revogar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}