import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import type { AuthUser } from "../lib/api";
import PatientAuthorizations from "./PatientAuthorizations";
import PatientSessions from "./PatientSessions";

interface Patient {
  id: string;
  name: string;
  guardianName: string;
  birthDate: string;
}

interface Objective {
  id: string;
  description: string;
}

interface TherapyProgram {
  id: string;
  name: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  objectives: Objective[];
}

interface PatientDetailsPageProps {
  patientId: string;
  user: AuthUser;
  onBack: () => void;
}

const statusLabels = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído"
};

export default function PatientDetailsPage({
  patientId,
  user,
  onBack
}: PatientDetailsPageProps) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [programs, setPrograms] = useState<TherapyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPatient, setEditingPatient] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const isAdmin = user.role === "ADMIN";

  useEffect(() => {
    const controller = new AbortController();

    async function loadDetails() {
      setLoading(true);
      setLoadError("");

      try {
        const [patientData, programData] = await Promise.all([
          api<{ patient: Patient }>(`/patients/${patientId}`, {
            signal: controller.signal
          }),
          api<{ programs: TherapyProgram[] }>(
            `/programs/patient/${patientId}`,
            { signal: controller.signal }
          )
        ]);

        if (!controller.signal.aborted) {
          setPatient(patientData.patient);
          setPrograms(programData.programs);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPatient(null);
          setPrograms([]);
          setLoadError(
            error instanceof ApiError
              ? error.message
              : "Não foi possível carregar o paciente."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDetails();

    return () => controller.abort();
  }, [patientId, refreshCount]);

  async function saveChange(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: object,
    form?: HTMLFormElement
  ) {
    if (saving) {
      return;
    }

    setSaving(true);
    setActionError("");

    try {
      await api<unknown>(path, {
        method,
        body: JSON.stringify(body)
      });

      setEditingPatient(false);
      form?.reset();
      setRefreshCount((current) => current + 1);
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível concluir a operação."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePatient() {
    if (saving || !window.confirm(`Excluir o paciente ${patient?.name}? Esta ação não pode ser desfeita.`)) return;
    setSaving(true);
    setActionError("");
    try {
      await api<void>(`/patients/${patientId}`, { method: "DELETE" });
      onBack();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Não foi possível excluir o paciente.");
    } finally {
      setSaving(false);
    }
  }

  function handleEditPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void saveChange(`/patients/${patientId}`, "PATCH", {
      name: String(data.get("name") ?? "").trim(),
      guardianName: String(data.get("guardianName") ?? "").trim(),
      birthDate: String(data.get("birthDate") ?? "")
    });
  }

  function handleCreateProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    void saveChange(
      "/programs",
      "POST",
      {
        patientId,
        name: String(data.get("name") ?? "").trim()
      },
      form
    );
  }

  function handleCreateObjective(
    event: FormEvent<HTMLFormElement>,
    programId: string
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    void saveChange(
      `/programs/${programId}/objectives`,
      "POST",
      {
        description: String(data.get("description") ?? "").trim()
      },
      form
    );
  }

  return (
    <section className="patients-section">
      <div className="section-toolbar">
        <button
          className="button button-secondary"
          type="button"
          onClick={onBack}
          disabled={saving}
        >
          Voltar aos pacientes
        </button>
      </div>

      {loading ? (
        <p role="status">Carregando paciente...</p>
      ) : loadError ? (
        <div className="panel">
          <p className="feedback-error" role="alert">
            {loadError}
          </p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setRefreshCount((current) => current + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : patient ? (
        <>
          <section className="panel" aria-labelledby="patient-title">
            <div className="section-toolbar">
              <h2 id="patient-title">{patient.name}</h2>
              {isAdmin && (
                <div className="record-actions">
                  <button type="button" className="button button-secondary" disabled={saving}
                    onClick={() => { setEditingPatient(!editingPatient); setActionError(""); }}>
                    {editingPatient ? "Cancelar edição" : "Editar paciente"}
                  </button>
                  <button type="button" className="button button-danger" disabled={saving} onClick={handleDeletePatient}>
                    Excluir paciente
                  </button>
                </div>
              )}
            </div>
            {isAdmin && editingPatient && (
              <form className="patient-form" onSubmit={handleEditPatient}>
                <div className="form-field">
                  <label htmlFor="edit-patient-name">Nome do paciente</label>
                  <input id="edit-patient-name" name="name" defaultValue={patient.name} maxLength={150} required disabled={saving} />
                </div>
                <div className="form-field">
                  <label htmlFor="edit-guardian-name">Nome do responsável</label>
                  <input id="edit-guardian-name" name="guardianName" defaultValue={patient.guardianName} maxLength={150} required disabled={saving} />
                </div>
                <div className="form-field">
                  <label htmlFor="edit-birth-date">Data de nascimento</label>
                  <input id="edit-birth-date" name="birthDate" type="date" defaultValue={patient.birthDate.slice(0, 10)} required disabled={saving} />
                </div>
                <button type="submit" className="button" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button>
              </form>
            )}
            <p>Responsável: {patient.guardianName}</p>
            <p>
              Nascimento:{" "}
              {patient.birthDate.slice(0, 10).split("-").reverse().join("/")}
            </p>
          </section>
          {isAdmin && (
            <PatientAuthorizations patientId={patientId} />
          )}
          {actionError && (
            <p className="feedback-error" role="alert">
              {actionError}
            </p>
          )}

          <h2>Programas terapêuticos</h2>

          {isAdmin && (
            <section className="panel">
              <h3>Novo programa</h3>

              <form className="inline-form" onSubmit={handleCreateProgram}>
                <div className="form-field">
                  <label htmlFor="program-name">Nome do programa</label>
                  <input
                    id="program-name"
                    name="name"
                    maxLength={150}
                    required
                    disabled={saving}
                  />
                </div>

                <button className="button" type="submit" disabled={saving}>
                  Criar programa
                </button>
              </form>
            </section>
          )}

          {programs.length === 0 && <p>Nenhum programa cadastrado.</p>}

          {programs.map((program) => (
            <article className="panel" key={program.id}>
              <div className="section-toolbar">
                <h3 className="program-title">{program.name}</h3>
                <div className="record-actions">
                  <span className="status-badge">{statusLabels[program.status]}</span>
                  {isAdmin && (
                    <button type="button" className="button button-danger" disabled={saving}
                      onClick={() => {
                        if (window.confirm(`Excluir o programa ${program.name} e seus objetivos? Programas com coletas não podem ser excluídos.`)) {
                          void saveChange(`/programs/${program.id}`, "DELETE");
                        }
                      }}>
                      Excluir programa
                    </button>
                  )}
                </div>
              </div>

              {program.objectives.length === 0 ? (
                <p>Nenhum objetivo cadastrado.</p>
              ) : (
                <ul className="objective-list">
                  {program.objectives.map((objective) => (
                    <li key={objective.id} className="objective-row">
                      <span>{objective.description}</span>
                      {isAdmin && (
                        <button type="button" className="button button-danger" disabled={saving || program.status !== "NOT_STARTED"}
                          title={program.status !== "NOT_STARTED" ? "Objetivos só podem ser excluídos antes do início do programa." : undefined}
                          aria-label={`Excluir objetivo: ${objective.description}`}
                          onClick={() => {
                            if (window.confirm(`Excluir o objetivo ${objective.description}?`)) {
                              void saveChange(`/programs/${program.id}/objectives/${objective.id}`, "DELETE");
                            }
                          }}>
                          Excluir objetivo
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {isAdmin && program.status === "NOT_STARTED" && (
                <>
                  <form
                    className="inline-form"
                    onSubmit={(event) =>
                      handleCreateObjective(event, program.id)
                    }
                  >
                    <div className="form-field">
                      <label htmlFor={`objective-${program.id}`}>
                        Novo objetivo
                      </label>
                      <input
                        id={`objective-${program.id}`}
                        name="description"
                        maxLength={500}
                        required
                        disabled={saving}
                      />
                    </div>

                    <button
                      className="button button-secondary"
                      type="submit"
                      disabled={saving}
                    >
                      Adicionar objetivo
                    </button>
                  </form>

                  <div className="program-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={saving || program.objectives.length === 0}
                      onClick={() =>
                        void saveChange(
                          `/programs/${program.id}/status`,
                          "PATCH",
                          { status: "IN_PROGRESS" }
                        )
                      }
                    >
                      Iniciar programa
                    </button>

                    {program.objectives.length === 0 && (
                      <p>Adicione um objetivo para iniciar.</p>
                    )}
                  </div>
                </>
              )}

              {isAdmin && program.status === "IN_PROGRESS" && (
                <div className="program-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Concluir este programa? Ele não poderá receber novas coletas nem ser reaberto nesta versão."
                      );

                      if (confirmed) {
                        void saveChange(
                          `/programs/${program.id}/status`,
                          "PATCH",
                          { status: "COMPLETED" }
                        );
                      }
                    }}
                  >
                    Concluir programa
                  </button>
                </div>
              )}
            </article>
          ))}
          <PatientSessions patientId={patientId} user={user} programs={programs}/>
        </>
      ) : null}
    </section>
  );
}