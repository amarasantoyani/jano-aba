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

  const result = await prisma.user.createMany({
    data: [
      {
        name: "Administrador de demonstração",
        email: "admin@example.com",
        passwordHash,
        role: "ADMIN"
      },
      {
        name: "Terapeuta de demonstração",
        email: "therapist@example.com",
        passwordHash,
        role: "THERAPIST"
      }
    ],
    skipDuplicates: true
  });

  console.log(`Created ${result.count} demo users.`);
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