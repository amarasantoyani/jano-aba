import "../prisma.test.config.js";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import * as argon2 from "argon2";

// Load the application only after the test configuration.
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { sessionStore } = await import("../src/routes/auth.js");

const origin = process.env.APP_ORIGIN!;

// Deliberately public credential used only in the isolated test database.
const testPassword = "AutomatedTestsOnly123!";

async function clearTestDatabase() {
  await prisma.$transaction([
    prisma.sessionRecord.deleteMany(),
    prisma.therapySession.deleteMany(),
    prisma.objective.deleteMany(),
    prisma.therapyProgram.deleteMany(),
    prisma.patientTherapistAuthorization.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.loginSession.deleteMany(),
    prisma.user.deleteMany()
  ]);
}

test("Clinical workflow", { timeout: 60000 }, async (t) => {
  t.after(async () => {
    try {
      await sessionStore.close();
      await clearTestDatabase();
    } finally {
      await prisma.$disconnect();
    }
  });

  await clearTestDatabase();

  const passwordHash = await argon2.hash(testPassword);

  const administrator = await prisma.user.create({
    data: {
      name: "Test Administrator",
      email: "admin@test.example",
      passwordHash,
      role: "ADMIN"
    }
  });

  const therapist = await prisma.user.create({
    data: {
      name: "Test Therapist",
      email: "therapist@test.example",
      passwordHash,
      role: "THERAPIST"
    }
  });

  const adminAgent = request.agent(app);
  const therapistAgent = request.agent(app);

  await adminAgent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({
      email: administrator.email,
      password: testPassword
    })
    .expect(200);

  await therapistAgent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({
      email: therapist.email,
      password: testPassword
    })
    .expect(200);

  async function createScenario(authorized = true) {
    const patient = await prisma.patient.create({
      data: {
        name: "Test Patient",
        guardianName: "Test Guardian",
        birthDate: new Date("2018-05-10T00:00:00.000Z")
      }
    });

    const firstProgram = await prisma.therapyProgram.create({
      data: {
        patientId: patient.id,
        name: "Program A",
        status: "IN_PROGRESS",
        objectives: {
          create: [
            { description: "Clap hands" },
            { description: "Unworked objective" }
          ]
        }
      },
      include: { objectives: true }
    });

    const secondProgram = await prisma.therapyProgram.create({
      data: {
        patientId: patient.id,
        name: "Program B",
        status: "IN_PROGRESS",
        objectives: {
          create: { description: "Draw a tree" }
        }
      },
      include: { objectives: true }
    });

    const authorization = authorized
      ? await prisma.patientTherapistAuthorization.create({
          data: {
            patientId: patient.id,
            therapistId: therapist.id,
            grantedById: administrator.id
          }
        })
      : null;

    return {
      patient,
      firstProgram,
      secondProgram,
      authorization,
      firstObjective: firstProgram.objectives.find(
        (objective) => objective.description === "Clap hands"
      )!,
      secondObjective: secondProgram.objectives[0]!
    };
  }

  function sessionPayload(patientId: string, objectiveId: string) {
    return {
      patientId,
      occurredAt: new Date().toISOString(),
      records: [{ objectiveId, achieved: false }]
    };
  }

  await t.test("requires login, administrator role and trusted origin", async () => {
    await request(app).get("/api/patients").expect(401);

    const body = {
      name: "Unauthorized Patient",
      guardianName: "Guardian",
      birthDate: "2018-05-10"
    };

    await therapistAgent
      .post("/api/patients")
      .set("Origin", origin)
      .send(body)
      .expect(403);

    await adminAgent
      .post("/api/patients")
      .set("Origin", "https://untrusted.example")
      .send(body)
      .expect(403);
  });

  await t.test("allows only one active authorization under concurrent grants", async () => {
    const scenario = await createScenario(false);

    const body = {
      patientId: scenario.patient.id,
      therapistId: therapist.id
    };

    const responses = await Promise.all([
      adminAgent.post("/api/authorizations").set("Origin", origin).send(body),
      adminAgent.post("/api/authorizations").set("Origin", origin).send(body)
    ]);

    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [201, 409]
    );

    const count = await prisma.patientTherapistAuthorization.count({
      where: {
        patientId: scenario.patient.id,
        therapistId: therapist.id,
        revokedAt: null
      }
    });

    assert.equal(count, 1);
  });

  await t.test("stores true and false results across programs without inventing missing results", async () => {
    const scenario = await createScenario();

    const response = await therapistAgent
      .post("/api/sessions")
      .set("Origin", origin)
      .send({
        patientId: scenario.patient.id,
        occurredAt: new Date().toISOString(),
        records: [
          { objectiveId: scenario.firstObjective.id, achieved: false },
          { objectiveId: scenario.secondObjective.id, achieved: true }
        ]
      })
      .expect(201);

    const records = await prisma.sessionRecord.findMany({
      where: { sessionId: response.body.session.id }
    });

    assert.equal(records.length, 2);
    assert.equal(
      records.find((record) => record.objectiveId === scenario.firstObjective.id)?.achieved,
      false
    );
    assert.equal(
      records.find((record) => record.objectiveId === scenario.secondObjective.id)?.achieved,
      true
    );
  });

  await t.test("rejects another patient's objective without saving a partial session", async () => {
    const scenario = await createScenario();
    const other = await createScenario(false);

    await therapistAgent
      .post("/api/sessions")
      .set("Origin", origin)
      .send({
        patientId: scenario.patient.id,
        occurredAt: new Date().toISOString(),
        records: [
          { objectiveId: scenario.firstObjective.id, achieved: true },
          { objectiveId: other.firstObjective.id, achieved: false }
        ]
      })
      .expect(400);

    const count = await prisma.therapySession.count({
      where: { authorizationId: scenario.authorization!.id }
    });

    assert.equal(count, 0);
  });

  await t.test("rejects duplicate objectives", async () => {
    const scenario = await createScenario();
    const body = sessionPayload(
      scenario.patient.id,
      scenario.firstObjective.id
    );

    body.records.push({ ...body.records[0]! });

    await therapistAgent
      .post("/api/sessions")
      .set("Origin", origin)
      .send(body)
      .expect(400);

    assert.equal(
      await prisma.therapySession.count({
        where: { authorizationId: scenario.authorization!.id }
      }),
      0
    );
  });

  await t.test("rejects collection for a completed program", async () => {
    const scenario = await createScenario();

    await adminAgent
      .patch(`/api/programs/${scenario.firstProgram.id}/status`)
      .set("Origin", origin)
      .send({ status: "COMPLETED" })
      .expect(200);

    await therapistAgent
      .post("/api/sessions")
      .set("Origin", origin)
      .send(sessionPayload(scenario.patient.id, scenario.firstObjective.id))
      .expect(409);

    assert.equal(
      await prisma.therapySession.count({
        where: { authorizationId: scenario.authorization!.id }
      }),
      0
    );
  });

  await t.test("revocation blocks access and preserves previous sessions", async () => {
    const scenario = await createScenario();
    const body = sessionPayload(
      scenario.patient.id,
      scenario.firstObjective.id
    );

    const created = await therapistAgent
      .post("/api/sessions")
      .set("Origin", origin)
      .send(body)
      .expect(201);

    const revokePath =
      `/api/authorizations/${scenario.authorization!.id}/revoke`;

    const firstRevocation = await adminAgent
      .post(revokePath)
      .set("Origin", origin)
      .expect(200);

    const repeatedRevocation = await adminAgent
      .post(revokePath)
      .set("Origin", origin)
      .expect(200);

    assert.equal(
      repeatedRevocation.body.authorization.revokedAt,
      firstRevocation.body.authorization.revokedAt
    );

    await therapistAgent
      .get(`/api/patients/${scenario.patient.id}`)
      .expect(404);

    await therapistAgent
      .post("/api/sessions")
      .set("Origin", origin)
      .send(body)
      .expect(403);

    const history = await adminAgent
      .get(`/api/sessions/patient/${scenario.patient.id}`)
      .expect(200);

    assert.equal(history.body.sessions.length, 1);
    assert.equal(history.body.sessions[0].id, created.body.session.id);
    assert.equal(history.body.sessions[0].records[0].achieved, false);
    assert.equal(
      history.body.sessions[0].authorization.therapist.id,
      therapist.id
    );
  });
});