import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { emailVerificationRequestSchema } from "@/lib/validation";
import { requestEmailVerification } from "@/lib/auth/emailVerification";
import { enforceRateLimit } from "@/lib/rateLimit";

export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const { email, name } = emailVerificationRequestSchema.parse(await req.json());

  await enforceRateLimit({ key: `email_verify_request:${session.customerId}`, max: 5 });

  if (name) {
    await prisma.customer.update({ where: { id: session.customerId }, data: { name } });
  }
  await requestEmailVerification(session.customerId, email);

  return ok({ sent: true });
});
