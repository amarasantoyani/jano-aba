import * as argon2 from "argon2";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const password = process.env.DEMO_PASSWORD;

  if (
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 1024
  ) {
    throw new Error(
      "DEMO_PASSWORD must have at least 12 characters and at most 1024 bytes."
    );
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id
  });

  await prisma.$transaction([
    prisma.user.upsert({
      where: { email: "admin@example.com" },
      create: { name: "admin", email: "admin@example.com", passwordHash, role: "ADMIN" },
      update: { name: "admin" }
    }),
    prisma.user.upsert({
      where: { email: "therapist@example.com" },
      create: { name: "terapeuta_1", email: "therapist@example.com", passwordHash, role: "THERAPIST" },
      update: { name: "terapeuta_1" }
    })
  ]);

  console.log("Initial accounts configured.");
}

main()
  .catch(() => {
    console.error(
      "Demo seed failed. Check DEMO_PASSWORD, migrations and database availability."
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });