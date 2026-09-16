import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";
import { requireAuth } from "./auth.js";

export const authorizationsRouter = Router();

authorizationsRouter.use(requireAuth);

authorizationsRouter.use((_req, res, next) => {
  if (res.locals.user.role !== "ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Somente administradores podem gerenciar autorizações."
    );
  }

  next();
});

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

authorizationsRouter.post("/", async (req, res) => {
  const patientId = validateId(req.body?.patientId);
  const therapistId = validateId(req.body?.therapistId);

  const [patient, therapist] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true }
    }),
    prisma.user.findUnique({
      where: { id: therapistId },
      select: { id: true, role: true }
    })
  ]);

  if (!patient) {
    throw new AppError(
      404,
      "PATIENT_NOT_FOUND",
      "Paciente não encontrado."
    );
  }

  if (!therapist || therapist.role !== "THERAPIST") {
    throw new AppError(
      400,
      "INVALID_THERAPIST",
      "Informe um usuário com perfil de terapeuta."
    );
  }

  try {
    const authorization =
      await prisma.patientTherapistAuthorization.create({
        data: {
          patientId,
          therapistId,
          grantedById: res.locals.user.id
        }
      });

    res.status(201).json({ authorization });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "AUTHORIZATION_ALREADY_ACTIVE",
        "Este terapeuta já possui autorização ativa para o paciente."
      );
    }

    throw error;
  }
});

authorizationsRouter.get("/patient/:patientId", async (req, res) => {
  const patientId = validateId(req.params.patientId);

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

  const authorizations =
    await prisma.patientTherapistAuthorization.findMany({
      where: { patientId },
      include: {
        therapist: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { grantedAt: "desc" },
        { id: "desc" }
      ],
      take: 100
    });

  res.status(200).json({
    authorizations,
    limit: 100
  });
});

authorizationsRouter.post("/:id/revoke", async (req, res) => {
  const id = validateId(req.params.id);

  await prisma.patientTherapistAuthorization.updateMany({
    where: {
      id,
      revokedAt: null
    },
    data: {
      revokedAt: new Date(),
      revokedById: res.locals.user.id
    }
  });

  const authorization =
    await prisma.patientTherapistAuthorization.findUnique({
      where: { id }
    });

  if (!authorization) {
    throw new AppError(
      404,
      "AUTHORIZATION_NOT_FOUND",
      "Autorização não encontrada."
    );
  }

  res.status(200).json({ authorization });
});