import { Router } from "express";
import type { RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import * as argon2 from "argon2";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const secret = process.env.SESSION_SECRET;
const connectionString = process.env.DATABASE_URL;
const appOrigin = process.env.APP_ORIGIN;

if (!secret || secret.length < 32) {
  throw new Error("SESSION_SECRET must have at least 32 characters.");
}

if (!connectionString || !appOrigin) {
  throw new Error("DATABASE_URL and APP_ORIGIN are required.");
}

const trustedOrigin = new URL(appOrigin).origin;
const isProduction = process.env.NODE_ENV === "production";
const cookieName = "jano.sid";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/"
};

const PgSessionStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgSessionStore({
    conString: connectionString,
    tableName: "session",
    createTableIfMissing: false
  }),
  name: cookieName,
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    ...cookieOptions,
    maxAge: 8 * 60 * 60 * 1000
  }
});

export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  if (req.get("origin") !== trustedOrigin) {
    next(new AppError(
      403,
      "INVALID_ORIGIN",
      "Origem da requisição não permitida."
    ));
    return;
  }

  next();
};

const publicUserFields = {
  id: true,
  name: true,
  email: true,
  role: true
} as const;

export const requireAuth: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    throw new AppError(401, "UNAUTHENTICATED", "Faça login para continuar.");
  }

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: publicUserFields
  });

  if (!user) {
    throw new AppError(401, "UNAUTHENTICATED", "Faça login para continuar.");
  }

  res.locals.user = user;
  next();
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: "TOO_MANY_ATTEMPTS",
      message: "Muitas tentativas de login. Tente novamente mais tarde."
    }
  }
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== "string" ||
    email.trim().length === 0 ||
    email.trim().length > 254 ||
    typeof password !== "string" ||
    password.length === 0 ||
    Buffer.byteLength(password, "utf8") > 1024
  ) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "Informe e-mail e senha válidos."
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() }
  });

  if (!user || !(await argon2.verify(user.passwordHash, password))) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "E-mail ou senha incorretos."
    );
  }

  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  req.session.userId = user.id;

  await new Promise<void>((resolve, reject) => {
    req.session.save((error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

authRouter.get("/me", requireAuth, (_req, res) => {
  res.status(200).json({
    user: res.locals.user
  });
});

authRouter.post("/logout", async (req, res) => {
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  res.clearCookie(cookieName, cookieOptions);
  res.status(204).end();
});