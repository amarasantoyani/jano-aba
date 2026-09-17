import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";
import { requireAuth } from "./auth.js";

export const therapistsRouter = Router();

therapistsRouter.use(requireAuth);

therapistsRouter.get("/", async (_req, res) => {
  if (res.locals.user.role !== "ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Somente administradores podem consultar a lista de terapeutas."
    );
  }

  const therapists = await prisma.user.findMany({
    where: { role: "THERAPIST" },
    select: {
      id: true,
      name: true,
      email: true
    },
    orderBy: [
      { name: "asc" },
      { id: "asc" }
    ]
  });

  res.json({ therapists });
});