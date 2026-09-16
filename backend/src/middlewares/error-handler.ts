import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/app-error.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  if (
    error instanceof Error &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "O corpo da requisição contém JSON inválido."
      }
    });
    return;
  }

  if (
    error instanceof Error &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "O corpo da requisição excede o tamanho permitido."
      }
    });
    return;
  }

  console.error({
    event: "unhandled_error",
    errorName: error instanceof Error ? error.name : "UnknownError"
  });

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Ocorreu um erro interno. Tente novamente."
    }
  });
};