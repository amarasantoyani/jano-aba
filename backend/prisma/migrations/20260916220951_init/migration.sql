-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'THERAPIST');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "guardianName" VARCHAR(150) NOT NULL,
    "birthDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientTherapistAuthorization" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "therapistId" UUID NOT NULL,
    "grantedById" UUID NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedById" UUID,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PatientTherapistAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapyProgram" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" "ProgramStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TherapyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapySession" (
    "id" UUID NOT NULL,
    "authorizationId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TherapySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRecord" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "objectiveId" UUID NOT NULL,
    "achieved" BOOLEAN NOT NULL,

    CONSTRAINT "SessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PatientTherapistAuthorization_patientId_idx" ON "PatientTherapistAuthorization"("patientId");

-- CreateIndex
CREATE INDEX "PatientTherapistAuthorization_therapistId_idx" ON "PatientTherapistAuthorization"("therapistId");

-- CreateIndex
CREATE INDEX "TherapyProgram_patientId_idx" ON "TherapyProgram"("patientId");

-- CreateIndex
CREATE INDEX "Objective_programId_idx" ON "Objective"("programId");

-- CreateIndex
CREATE INDEX "TherapySession_authorizationId_occurredAt_idx" ON "TherapySession"("authorizationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRecord_sessionId_objectiveId_key" ON "SessionRecord"("sessionId", "objectiveId");

-- AddForeignKey
ALTER TABLE "PatientTherapistAuthorization" ADD CONSTRAINT "PatientTherapistAuthorization_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PatientTherapistAuthorization" ADD CONSTRAINT "PatientTherapistAuthorization_therapistId_fkey" FOREIGN KEY ("therapistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PatientTherapistAuthorization" ADD CONSTRAINT "PatientTherapistAuthorization_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PatientTherapistAuthorization" ADD CONSTRAINT "PatientTherapistAuthorization_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TherapyProgram" ADD CONSTRAINT "TherapyProgram_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TherapyProgram"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TherapySession" ADD CONSTRAINT "TherapySession_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "PatientTherapistAuthorization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SessionRecord" ADD CONSTRAINT "SessionRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TherapySession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SessionRecord" ADD CONSTRAINT "SessionRecord_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- Allow only one active authorization per patient and therapist.
CREATE UNIQUE INDEX "PatientTherapistAuthorization_active_unique"
ON "PatientTherapistAuthorization" ("patientId", "therapistId")
WHERE "revokedAt" IS NULL;

-- Require revocation timestamp and author together.
ALTER TABLE "PatientTherapistAuthorization"
ADD CONSTRAINT "PatientTherapistAuthorization_revocation_pair_check"
CHECK (
  ("revokedAt" IS NULL AND "revokedById" IS NULL)
  OR
  ("revokedAt" IS NOT NULL AND "revokedById" IS NOT NULL)
);

-- Prevent revocation before the authorization was granted.
ALTER TABLE "PatientTherapistAuthorization"
ADD CONSTRAINT "PatientTherapistAuthorization_revocation_date_check"
CHECK (
  "revokedAt" IS NULL OR "revokedAt" >= "grantedAt"
);