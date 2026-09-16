import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";
import { requireAuth } from "./auth.js";

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

function validateId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new AppError(400, "INVALID_INPUT", "Identificador inválido.");
  }

  return value.toLowerCase();
}

sessionsRouter.post("/", async (req, res) => {
  const user = res.locals.user;

  if (user.role !== "THERAPIST") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Somente terapeutas podem registrar atendimentos."
    );
  }

  const patientId = validateId(req.body?.patientId);
  const occurredAtInput: unknown = req.body?.occurredAt;
  const recordsInput: unknown = req.body?.records;

  if (typeof occurredAtInput !== "string") {
    throw new AppError(
      400,
      "INVALID_DATE",
      "Informe a data e hora do atendimento."
    );
  }

  const occurredAt = new Date(occurredAtInput);

  if (
    Number.isNaN(occurredAt.getTime()) ||
    occurredAt.toISOString() !== occurredAtInput ||
    occurredAt.getTime() > Date.now()
  ) {
    throw new AppError(
      400,
      "INVALID_DATE",
      "Use uma data válida em UTC, com milissegundos, que não esteja no futuro."
    );
  }

  if (
    !Array.isArray(recordsInput) ||
    recordsInput.length === 0 ||
    recordsInput.length > 100
  ) {
    throw new AppError(
      400,
      "INVALID_RECORDS",
      "Informe entre 1 e 100 resultados por sessão."
    );
  }

  const records = recordsInput.map((record: unknown) => {
    if (
      typeof record !== "object" ||
      record === null ||
      !("objectiveId" in record) ||
      !("achieved" in record) ||
      typeof record.achieved !== "boolean"
    ) {
      throw new AppError(
        400,
        "INVALID_RECORDS",
        "Cada resultado deve conter objectiveId e achieved booleano."
      );
    }

    return {
      objectiveId: validateId(record.objectiveId),
      achieved: record.achieved
    };
  });

  const objectiveIds = records.map((record) => record.objectiveId);

  if (new Set(objectiveIds).size !== objectiveIds.length) {
    throw new AppError(
      400,
      "DUPLICATE_OBJECTIVE",
      "Um objetivo não pode aparecer duas vezes na mesma sessão."
    );
  }

  const session = await prisma.$transaction(async (tx) => {
    const authorizations = await tx.$queryRaw<
      Array<{ id: string; grantedAt: Date }>
    >`
      SELECT "id", "grantedAt"
      FROM "PatientTherapistAuthorization"
      WHERE "patientId" = ${patientId}::uuid
        AND "therapistId" = ${user.id}::uuid
        AND "revokedAt" IS NULL
      FOR UPDATE
    `;

    const authorization = authorizations[0];

    if (!authorization) {
      throw new AppError(
        403,
        "PATIENT_NOT_AUTHORIZED",
        "Você não possui autorização ativa para atender este paciente."
      );
    }

    if (occurredAt < authorization.grantedAt) {
      throw new AppError(
        400,
        "DATE_BEFORE_AUTHORIZATION",
        "O atendimento não pode ser anterior à autorização utilizada."
      );
    }

    const objectives = await tx.objective.findMany({
      where: {
        id: { in: objectiveIds },
        program: { patientId }
      },
      select: {
        id: true,
        programId: true
      }
    });

    if (objectives.length !== objectiveIds.length) {
      throw new AppError(
        400,
        "INVALID_OBJECTIVES",
        "Todos os objetivos devem existir e pertencer ao paciente."
      );
    }

    const programIds = [
      ...new Set(objectives.map((objective) => objective.programId))
    ];

    const programParameters = Prisma.join(
      programIds.map((id) => Prisma.sql`${id}::uuid`)
    );

    const programs = await tx.$queryRaw<
      Array<{ id: string; status: string }>
    >`
      SELECT "id", "status"
      FROM "TherapyProgram"
      WHERE "id" IN (${programParameters})
      ORDER BY "id"
      FOR UPDATE
    `;

    if (
      programs.length !== programIds.length ||
      programs.some((program) => program.status !== "IN_PROGRESS")
    ) {
      throw new AppError(
        409,
        "PROGRAM_NOT_IN_PROGRESS",
        "Todos os objetivos devem pertencer a programas em andamento."
      );
    }

    return tx.therapySession.create({
      data: {
        authorizationId: authorization.id,
        occurredAt,
        records: {
          create: records
        }
      },
      include: {
        records: true
      }
    });
  });

  res.status(201).json({ session });
});

sessionsRouter.get("/patient/:patientId", async (req, res) => {
  const patientId = validateId(req.params.patientId);
  const user = res.locals.user;
  const pageInput = req.query.page ?? "1";

  if (
    typeof pageInput !== "string" ||
    !/^[1-9]\d*$/.test(pageInput)
  ) {
    throw new AppError(400, "INVALID_PAGE", "Página inválida.");
  }

  const page = Number(pageInput);
  const limit = 20;
  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip) || skip > 2147483647) {
    throw new AppError(400, "INVALID_PAGE", "Página inválida.");
  }

  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
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
    },
    select: { id: true }
  });

  if (!patient) {
    throw new AppError(
      404,
      "PATIENT_NOT_FOUND",
      "Paciente não encontrado."
    );
  }

  const sessions = await prisma.therapySession.findMany({
    where: {
      authorization: { patientId }
    },
    include: {
      authorization: {
        select: {
          therapist: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      records: {
        include: {
          objective: {
            select: {
              id: true,
              description: true,
              programId: true
            }
          }
        },
        orderBy: { id: "asc" }
      }
    },
    orderBy: [
      { occurredAt: "desc" },
      { id: "desc" }
    ],
    skip,
    take: limit
  });

  res.status(200).json({
    sessions,
    page,
    limit
  });
});