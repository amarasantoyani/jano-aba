import express from "express";
import { prisma } from "./lib/prisma.js";
import {authRouter, requireTrustedOrigin, sessionMiddleware} from "./routes/auth.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { patientsRouter } from "./routes/patients.js";
import { authorizationsRouter } from "./routes/authorizations.js";
import { programsRouter } from "./routes/programs.js";
import { sessionsRouter } from "./routes/sessions.js";
import { therapistsRouter } from "./routes/therapists.js";
import { fileURLToPath } from "node:url";

export const app = express();
if (process.env.RENDER === "true") {
  app.set("trust proxy", 1);
}
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok"
  });
});

app.get("/api/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok"
    });
  } catch {
    res.status(503).json({
      status: "unavailable"
    });
  }
});

app.use("/api", requireTrustedOrigin);
app.use("/api", sessionMiddleware);

app.use("/api/auth", authRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/authorizations", authorizationsRouter);
app.use("/api/programs", programsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/therapists", therapistsRouter);

const frontendDirectory = fileURLToPath(
  new URL("../../frontend/dist/", import.meta.url)
);

app.use(express.static(frontendDirectory));
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Recurso não encontrado."
    }
  });
});

app.use(errorHandler);
