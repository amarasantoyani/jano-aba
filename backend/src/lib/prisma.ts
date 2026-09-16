import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const adapter = new PrismaPg({
  connectionString,
  connectionTimeoutMillis: 5000
});

export const prisma = new PrismaClient({ adapter });