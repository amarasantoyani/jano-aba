import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const result = config({
  path: fileURLToPath(new URL("../.env.test", import.meta.url)),
  override: true,
  quiet: true
});

if (result.error) {
  throw new Error("Create the root .env.test file before running tests.");
}

const connectionString = env("DATABASE_URL");
const databaseUrl = new URL(connectionString);

if (
  databaseUrl.pathname !== "/jano_aba_test" ||
  !["localhost", "127.0.0.1"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "15432"
) {
  throw new Error(
    "Tests require the local jano_aba_test database on port 15432."
  );
}

process.env.NODE_ENV = "test";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: connectionString
  }
});