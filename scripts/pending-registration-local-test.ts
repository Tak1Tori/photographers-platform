import { compare } from "bcryptjs";
import { LegalDocumentType } from "@prisma/client";
import { startRegistrationAction } from "../app/auth/actions";
import { authOptions } from "../lib/auth";
import { prisma } from "../lib/prisma";

const testPhones = ["+77019990001", "+77019990002"];
const testEmails = ["registration-client@example.test", "registration-photographer@example.test"];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run() {
  try {
    await prisma.pendingRegistration.deleteMany({ where: { phone: { in: testPhones } } });
    await prisma.user.deleteMany({ where: { OR: [{ phone: { in: testPhones } }, { email: { in: testEmails } }] } });

    const usersBefore = await prisma.user.count();
    const pendingBefore = await prisma.pendingRegistration.count();

    const clientRegistration = await startRegistrationAction({
      name: "Registration Client",
      email: "REGISTRATION-CLIENT@EXAMPLE.TEST",
      phone: "8 701 999 00 01",
      password: "password123",
      role: "CLIENT",
      acceptedLegal: true
    });
    assert(clientRegistration.success, "Client registration failed");

    const client = await prisma.user.findUnique({
      where: { phone: testPhones[0] },
      include: { photographerProfile: true, legalAcceptances: true }
    });
    assert(client, "Client user was not created");
    assert(client.phone === testPhones[0], "Client phone was not normalized");
    assert(client.email === testEmails[0], "Client email was not normalized");
    assert(client.phoneVerifiedAt === null, "Unverified client has phoneVerifiedAt");
    assert(client.emailVerified === null, "Unverified client has emailVerified");
    assert(await compare("password123", client.passwordHash ?? ""), "Client password hash is invalid");
    assert(client.photographerProfile === null, "Client unexpectedly has a photographer profile");
    assert(
      client.legalAcceptances.filter(({ documentType }) => documentType === LegalDocumentType.TERMS).length === 1 &&
        client.legalAcceptances.filter(({ documentType }) => documentType === LegalDocumentType.PRIVACY).length === 1,
      "Client legal acceptances are incomplete"
    );
    assert((await prisma.pendingRegistration.count()) === pendingBefore, "Client registration created PendingRegistration");

    const credentialsProvider = authOptions.providers[0] as
      | {
          options?: {
            authorize?: (
              credentials: Record<string, string>,
              request: Request
            ) => Promise<{ id?: string } | null>;
          };
        }
      | undefined;
    const authorizeCredentials = credentialsProvider?.options?.authorize;
    if (!authorizeCredentials) throw new Error("Credentials provider is unavailable");
    const credentialsLogins = await Promise.all(
      ["87019990001", testPhones[0]].map((loginPhone) =>
        authorizeCredentials(
          { phone: loginPhone, password: "password123" },
          new Request("http://localhost/auth/sign-in")
        )
      )
    );
    assert(
      credentialsLogins.some((credentialsLogin) => credentialsLogin?.id === client.id),
      "Credentials login failed for the new client"
    );

    const photographerRegistration = await startRegistrationAction({
      name: "Registration Photographer",
      email: testEmails[1],
      phone: "+7 701 999 00 02",
      password: "password123",
      role: "PHOTOGRAPHER",
      acceptedLegal: true
    });
    assert(photographerRegistration.success, "Photographer registration failed");

    const photographer = await prisma.user.findUnique({
      where: { phone: testPhones[1] },
      include: { photographerProfile: true, legalAcceptances: true }
    });
    assert(photographer, "Photographer user was not created");
    assert(photographer.phoneVerifiedAt === null, "Unverified photographer has phoneVerifiedAt");
    assert(photographer.emailVerified === null, "Unverified photographer has emailVerified");
    assert(photographer.photographerProfile, "Photographer profile was not created");
    assert(
      photographer.legalAcceptances.some(({ documentType }) => documentType === LegalDocumentType.TERMS) &&
        photographer.legalAcceptances.some(({ documentType }) => documentType === LegalDocumentType.PRIVACY),
      "Photographer legal acceptances are incomplete"
    );

    const duplicate = await startRegistrationAction({
      name: "Duplicate",
      email: "another-email@example.test",
      phone: "87019990001",
      password: "password123",
      role: "CLIENT",
      acceptedLegal: true
    });
    assert(!duplicate.success, "Duplicate phone was accepted");
    assert(duplicate.error === "Этот номер телефона уже зарегистрирован", "Duplicate error is unclear");
    assert((await prisma.user.count()) === usersBefore + 2, "Unexpected user count after duplicate registration");

    const duplicateEmail = await startRegistrationAction({
      name: "Duplicate Email",
      email: "REGISTRATION-CLIENT@EXAMPLE.TEST",
      phone: "+7 701 999 00 03",
      password: "password123",
      role: "CLIENT",
      acceptedLegal: true
    });
    assert(!duplicateEmail.success, "Duplicate email was accepted");
    assert(duplicateEmail.error === "Этот email уже зарегистрирован", "Duplicate email error is unclear");
    assert((await prisma.user.count()) === usersBefore + 2, "Duplicate email created a User");

    console.log("Registration without Telegram Gateway local integration tests: passed");
  } finally {
    await prisma.pendingRegistration.deleteMany({ where: { phone: { in: testPhones } } });
    await prisma.user.deleteMany({ where: { OR: [{ phone: { in: testPhones } }, { email: { in: testEmails } }] } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Registration local test failed");
  process.exitCode = 1;
});
