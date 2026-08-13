import { compare } from "bcryptjs";
import { LegalDocumentType } from "@prisma/client";
import { prisma } from "../lib/prisma";

const testPhones = [
  "+77019990001",
  "+77019990002",
  "+77019990003",
  "+77019990004",
  "+77019990005"
];

const originalFetch = globalThis.fetch;
let requestSequence = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function userCount(phone: string) {
  return prisma.user.count({ where: { phone } });
}

async function run() {
  process.env.TELEGRAM_GATEWAY_TOKEN = "local-test-token";
  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body ?? "{}")) as { code?: string };
    const url = String(_input);

    if (url.endsWith("/sendVerificationMessage")) {
      requestSequence += 1;
      return Response.json({ ok: true, result: { request_id: `local-request-${requestSequence}` } });
    }

    if (url.endsWith("/checkVerificationStatus")) {
      return Response.json({
        ok: true,
        result: {
          verification_status: {
            status: payload.code === "222222" ? "code_valid" : "code_invalid"
          }
        }
      });
    }

    throw new Error("Unexpected Gateway request in local test");
  };

  const {
    startRegistrationAction,
    verifyRegistrationCodeAction
  } = await import("../app/auth/actions");

  try {
    await prisma.pendingRegistration.deleteMany({ where: { phone: { in: testPhones } } });
    await prisma.user.deleteMany({ where: { phone: { in: testPhones } } });

    const invalid = await startRegistrationAction({
      name: "Gateway Invalid",
      phone: "8 701 999 00 01",
      password: "password123",
      role: "CLIENT",
      acceptedLegal: true
    });
    assert(invalid.success, "Could not create pending registration for invalid-code test");
    const invalidResult = await verifyRegistrationCodeAction({
      pendingRegistrationId: invalid.pendingRegistrationId,
      code: "111111"
    });
    assert(!invalidResult.success, "Invalid OTP unexpectedly succeeded");
    assert((await userCount(testPhones[0])) === 0, "Invalid OTP created a User");

    const expired = await startRegistrationAction({
      name: "Gateway Expired",
      phone: "+7 701 999 00 02",
      password: "password123",
      role: "CLIENT",
      acceptedLegal: true
    });
    assert(expired.success, "Could not create pending registration for expired-code test");
    await prisma.pendingRegistration.update({
      where: { id: expired.pendingRegistrationId },
      data: { expiresAt: new Date(Date.now() - 1_000) }
    });
    const expiredResult = await verifyRegistrationCodeAction({
      pendingRegistrationId: expired.pendingRegistrationId,
      code: "222222"
    });
    assert(!expiredResult.success, "Expired OTP unexpectedly succeeded");
    assert((await userCount(testPhones[1])) === 0, "Expired OTP created a User");

    const verified = await startRegistrationAction({
      name: "Gateway Photographer",
      phone: "+7 701 999 00 03",
      password: "password123",
      role: "PHOTOGRAPHER",
      acceptedLegal: true
    });
    assert(verified.success, "Could not create pending registration for valid-code test");
    const verifiedResult = await verifyRegistrationCodeAction({
      pendingRegistrationId: verified.pendingRegistrationId,
      code: "222222"
    });
    assert(verifiedResult.success, "Valid OTP did not succeed");
    const verifiedUser = await prisma.user.findUnique({
      where: { phone: testPhones[2] },
      include: { photographerProfile: true, legalAcceptances: true }
    });
    assert(verifiedUser?.phoneVerifiedAt, "Verified user has no phoneVerifiedAt");
    assert(verifiedUser.photographerProfile, "Photographer profile was not created after verification");
    assert(await compare("password123", verifiedUser.passwordHash ?? ""), "Password login hash is invalid");
    assert(
      verifiedUser.legalAcceptances.some((acceptance) => acceptance.documentType === LegalDocumentType.TERMS) &&
        verifiedUser.legalAcceptances.some((acceptance) => acceptance.documentType === LegalDocumentType.PRIVACY),
      "Legal acceptances were not created after verification"
    );
    assert(
      (await prisma.pendingRegistration.count({ where: { id: verified.pendingRegistrationId } })) === 0,
      "Completed pending registration was not removed"
    );

    const duplicate = await startRegistrationAction({
      name: "Already Registered",
      phone: "+7 701 999 00 03",
      password: "password123",
      role: "CLIENT",
      acceptedLegal: true
    });
    assert(!duplicate.success, "Existing phone was accepted for a second registration");

    const parallel = await startRegistrationAction({
      name: "Gateway Parallel",
      phone: "+7 701 999 00 04",
      password: "password123",
      role: "CLIENT",
      acceptedLegal: true
    });
    assert(parallel.success, "Could not create pending registration for race test");
    const parallelResults = await Promise.all([
      verifyRegistrationCodeAction({ pendingRegistrationId: parallel.pendingRegistrationId, code: "222222" }),
      verifyRegistrationCodeAction({ pendingRegistrationId: parallel.pendingRegistrationId, code: "222222" })
    ]);
    assert(parallelResults.filter((result) => result.success).length === 1, "Parallel verification did not produce exactly one success");
    assert((await userCount(testPhones[3])) === 1, "Parallel verification created duplicate users");

    const abandoned = await startRegistrationAction({
      name: "Gateway Abandoned",
      phone: "+7 701 999 00 05",
      password: "password123",
      role: "EDITOR",
      acceptedLegal: true
    });
    assert(abandoned.success, "Could not create pending registration for abandonment test");
    assert((await userCount(testPhones[4])) === 0, "Unverified registration created a User");
    assert(
      (await prisma.pendingRegistration.count({ where: { id: abandoned.pendingRegistrationId } })) === 1,
      "Abandoned registration did not remain pending"
    );

    console.log("Pending registration local integration tests: passed");
  } finally {
    globalThis.fetch = originalFetch;
    await prisma.pendingRegistration.deleteMany({ where: { phone: { in: testPhones } } });
    await prisma.user.deleteMany({ where: { phone: { in: testPhones } } });
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Pending registration local test failed");
  process.exitCode = 1;
});
