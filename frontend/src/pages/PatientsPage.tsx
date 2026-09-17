import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import type { AuthUser } from "../lib/api";
import PatientDetailsPage from "./PatientDetailsPage";

interface Patient {
  id: string;
  name: string;
  guardianName: string;
  birthDate: string;
}

interface PatientsResponse {
  patients: Patient[];
  page: number;
  limit: number;
}

interface PatientsPageProps {
  user: AuthUser;
}

function calculateAge(birthDate: string): number {
  const [year, month, day] = birthDate.slice(0, 10).split("-").map(Number);
  const today = new Date();

  let age = today.getFullYear() - year;

  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age--;
  }

  return age;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 401
      ? "Sua sessão expirou. Saia e entre novamente."
      : error.message;
  }

  return "Não foi possível conectar ao sistema.";
}

export default function PatientsPage({ user }: PatientsPageProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [page, setPage] = useState(1);
  const [refreshCount, setRefreshCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const limit = 20;

  useEffect(() => {
    const controller = new AbortController();

    async function loadPatients() {
      setLoading(true);
      setListError("");

      try {
        const data = await api<PatientsResponse>(
          `/patients?page=${page}&limit=${limit}`,
          { signal: controller.signal }
        );

        if (!controller.signal.aborted) {
          setPatients(data.patients);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPatients([]);
          setListError(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPatients();

    return () => controller.abort();
  }, [page, refreshCount]);

  async function handleCreatePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    setSaving(true);
    setFormError("");
    setSuccessMessage("");

    try {
      await api<{ patient: Patient }>("/patients", {
        method: "POST",
        body: JSON.stringify({
          name: String(formData.get("name") ?? "").trim(),
          guardianName: String(formData.get("guardianName") ?? "").trim(),
          birthDate: String(formData.get("birthDate") ?? "")
        })
      });

      form.reset();
      setSuccessMessage("Paciente cadastrado.");
      setPage(1);
      setRefreshCount((current) => current + 1);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }
if (selectedPatientId) {
  return (
    <PatientDetailsPage
      key={selectedPatientId}
      patientId={selectedPatientId}
      user={user}
      onBack={() => {
        setSelectedPatientId(null);
        setRefreshCount((current) => current + 1);
      }}
    />
  );
}
  return (
    <section className="patients-section" aria-labelledby="patients-title">
      <div className="section-toolbar">
        <h2 id="patients-title">Pacientes</h2>

        <button
          className="button button-secondary"
          type="button"
          disabled={loading}
          onClick={() => setRefreshCount((current) => current + 1)}
        >
          Atualizar lista
        </button>
      </div>

      {user.role === "ADMIN" && (
        <section className="panel" aria-labelledby="new-patient-title">
          <h3 id="new-patient-title">Cadastrar paciente</h3>

          <form className="patient-form" onSubmit={handleCreatePatient}>
            <div className="form-field">
              <label htmlFor="patient-name">Nome do paciente</label>
              <input
                id="patient-name"
                name="name"
                maxLength={150}
                required
                disabled={saving}
              />
            </div>

            <div className="form-field">
              <label htmlFor="guardian-name">Nome do responsável</label>
              <input
                id="guardian-name"
                name="guardianName"
                maxLength={150}
                required
                disabled={saving}
              />
            </div>

            <div className="form-field">
              <label htmlFor="birth-date">Data de nascimento</label>
              <input
                id="birth-date"
                name="birthDate"
                type="date"
                required
                disabled={saving}
              />
            </div>

            <div className="form-actions">
              <button className="button" type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Cadastrar"}
              </button>
            </div>
          </form>

          {formError && (
            <p className="feedback-error" role="alert">
              {formError}
            </p>
          )}

          {successMessage && (
            <p className="feedback-success" role="status">
              {successMessage}
            </p>
          )}
        </section>
      )}

      {loading ? (
        <p role="status">Carregando pacientes...</p>
      ) : listError ? (
        <p className="feedback-error" role="alert">
          {listError}
        </p>
      ) : patients.length === 0 ? (
        <p>
          {page > 1
            ? "Não há mais pacientes nesta página."
            : user.role === "ADMIN"
              ? "Nenhum paciente cadastrado."
              : "Nenhum paciente autorizado para você no momento."}
        </p>
      ) : (
        <div
          className="table-container"
          role="region"
          aria-label="Lista de pacientes"
          tabIndex={0}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Paciente</th>
                <th scope="col">Responsável</th>
                <th scope="col">Idade</th>
              </tr>
            </thead>

            <tbody>
            {patients.map((patient) => (
                <tr key={patient.id}>
                <td>
                    <button
                    className="text-button"
                    type="button"
                    onClick={() => setSelectedPatientId(patient.id)}
                    >
                    {patient.name}
                    </button>
                </td>
                <td>{patient.guardianName}</td>
                <td>{calculateAge(patient.birthDate)} anos</td>
                </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="pagination" aria-label="Paginação de pacientes">
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
          disabled={loading || Boolean(listError) || patients.length < limit}
          onClick={() => setPage((current) => current + 1)}
        >
          Próxima
        </button>
      </nav>
    </section>
  );
}