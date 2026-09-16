import { Router } from "express";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";
import { requireAuth } from "./auth.js";

export const programsRouter = Router();

programsRouter.use(requireAuth);

const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.user.role !== "ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Somente administradores podem gerenciar programas e objetivos."
    );
  }

  next();
};

function validateId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "Informe um identificador válido."
    );
  }

  return value;
}

function validateText(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      `Informe um texto com 1 a ${maxLength} caracteres.`
    );
  }

  return value.trim();
}

programsRouter.post("/", requireAdmin, async (req, res) => {
  const patientId = validateId(req.body?.patientId);
  const name = validateText(req.body?.name, 150);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true }
  });

  if (!patient) {
    throw new AppError(
      404,
      "PATIENT_NOT_FOUND",
      "Paciente não encontrado."
    );
  }

  const program = await prisma.therapyProgram.create({
    data: {
      patientId,
      name
    }
  });

  res.status(201).json({ program });
});

programsRouter.get("/patient/:patientId", async (req, res) => {
  const patientId = validateId(req.params.patientId);
  const user = res.locals.user;

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

  const programs = await prisma.therapyProgram.findMany({
    where: { patientId },
    include: {
      objectives: {
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" }
        ]
      }
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" }
    ]
  });

  res.status(200).json({ programs });
});

programsRouter.post("/:id/objectives", requireAdmin, async (req, res) => {
  const programId = validateId(req.params.id);
  const description = validateText(req.body?.description, 500);

  const objective = await prisma.$transaction(async (tx) => {
    const programs = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status"
      FROM "TherapyProgram"
      WHERE "id" = ${programId}::uuid
      FOR UPDATE
    `;

    const program = programs[0];

    if (!program) {
      throw new AppError(
        404,
        "PROGRAM_NOT_FOUND",
        "Programa não encontrado."
      );
    }

    if (program.status !== "NOT_STARTED") {
      throw new AppError(
        409,
        "PROGRAM_ALREADY_STARTED",
        "Objetivos só podem ser adicionados antes do início do programa."
      );
    }

    return tx.objective.create({
      data: {
        programId,
        description
      }
    });
  });

  res.status(201).json({ objective });
});

programsRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const id = validateId(req.params.id);
  const status = req.body?.status;

  if (
    status !== "NOT_STARTED" &&
    status !== "IN_PROGRESS" &&
    status !== "COMPLETED"
  ) {
    throw new AppError(
      400,
      "INVALID_STATUS",
      "Estado do programa inválido."
    );
  }

  const program = await prisma.$transaction(async (tx) => {
    const programs = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT "status"
      FROM "TherapyProgram"
      WHERE "id" = ${id}::uuid
      FOR UPDATE
    `;

    const current = programs[0];

    if (!current) {
      throw new AppError(
        404,
        "PROGRAM_NOT_FOUND",
        "Programa não encontrado."
      );
    }

    if (current.status === status) {
      return tx.therapyProgram.findUniqueOrThrow({
        where: { id }
      });
    }

    const canStart =
      current.status === "NOT_STARTED" && status === "IN_PROGRESS";

    const canComplete =
      current.status === "IN_PROGRESS" && status === "COMPLETED";

    if (!canStart && !canComplete) {
      throw new AppError(
        409,
        "INVALID_STATUS_TRANSITION",
        "A mudança de estado solicitada não é permitida."
      );
    }

    if (canStart) {
      const objectiveCount = await tx.objective.count({
        where: { programId: id }
      });

      if (objectiveCount === 0) {
        throw new AppError(
          409,
          "PROGRAM_WITHOUT_OBJECTIVES",
          "Adicione pelo menos um objetivo antes de iniciar o programa."
        );
      }
    }

    return tx.therapyProgram.update({
      where: { id },
      data: { status }
    });
  });

  res.status(200).json({ program });
});