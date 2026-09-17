import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";
import { requireAuth } from "./auth.js";

export const patientsRouter = Router();

patientsRouter.use(requireAuth);

function validateId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(404, "PATIENT_NOT_FOUND", "Paciente não encontrado.");
  }
  return value;
}

function validateName(value: unknown, fieldName: string): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > 150
  ) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      `${fieldName} deve conter entre 1 e 150 caracteres.`
    );
  }

  return value.trim();
}

function validateBirthDate(value: unknown): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000-")
  ) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "Informe a data de nascimento no formato AAAA-MM-DD."
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  const today = new Date().toISOString().slice(0, 10);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value > today
  ) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "A data de nascimento deve ser válida e não pode estar no futuro."
    );
  }

  return date;
}

function parsePositiveInteger(
  value: unknown,
  defaultValue: number
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new AppError(
      400,
      "INVALID_PAGINATION",
      "Página e limite devem ser números inteiros positivos."
    );
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw new AppError(
      400,
      "INVALID_PAGINATION",
      "Valor de paginação inválido."
    );
  }

  return number;
}

patientsRouter.post("/", async (req, res) => {
  if (res.locals.user.role !== "ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Somente administradores podem cadastrar pacientes."
    );
  }

  const { name, guardianName, birthDate } = req.body ?? {};

  const patient = await prisma.patient.create({
    data: {
      name: validateName(name, "Nome do paciente"),
      guardianName: validateName(guardianName, "Nome do responsável"),
      birthDate: validateBirthDate(birthDate)
    }
  });

  res
    .status(201)
    .location(`/api/patients/${patient.id}`)
    .json({ patient });
});

patientsRouter.get("/", async (req, res) => {
  const user = res.locals.user;
  const page = parsePositiveInteger(req.query.page, 1);
  const limit = parsePositiveInteger(req.query.limit, 20);
  const skip = (page - 1) * limit;

  if (limit > 100 || !Number.isSafeInteger(skip) || skip > 2147483647) {
    throw new AppError(
      400,
      "INVALID_PAGINATION",
      "Paginação inválida. O limite máximo por página é 100."
    );
  }

  const patients = await prisma.patient.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : {
            authorizations: {
              some: {
                therapistId: user.id,
                revokedAt: null
              }
            }
          },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" }
    ],
    skip,
    take: limit
  });

  res.status(200).json({
    patients,
    page,
    limit
  });
});

patientsRouter.get("/:id", async (req, res) => {
  const user = res.locals.user;
  const id = validateId(req.params.id);

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      ...(user.role === "ADMIN"
        ? {}
        : {
            authorizations: {
              some: {
                therapistId: user.id,
                revokedAt: null
              }
            }
          })
    }
  });

  if (!patient) {
    throw new AppError(
      404,
      "PATIENT_NOT_FOUND",
      "Paciente não encontrado."
    );
  }

  res.status(200).json({ patient });
});

patientsRouter.patch("/:id", async (req, res) => {
  if (res.locals.user.role !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Somente administradores podem editar pacientes.");
  }
  const id = validateId(req.params.id);
  const { name, guardianName, birthDate } = req.body ?? {};
  const patient = await prisma.patient.update({
    where: { id },
    data: {
      name: validateName(name, "Nome do paciente"),
      guardianName: validateName(guardianName, "Nome do responsável"),
      birthDate: validateBirthDate(birthDate)
    }
  });
  res.json({ patient });
});

patientsRouter.delete("/:id", async (req, res) => {
  if (res.locals.user.role !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Somente administradores podem excluir pacientes.");
  }
  const id = validateId(req.params.id);
  // Foreign keys also protect against a concurrent program or authorization creation.
  await prisma.patient.delete({ where: { id } });
  res.status(204).end();
});
