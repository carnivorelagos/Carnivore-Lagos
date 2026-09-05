import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { emailVerificationConfirmSchema } from "@/lib/validation";
import { confirmEmailVerification } from "@/lib/auth/emailVerification";

export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const { code } = emailVerificationConfirmSchema.parse(await req.json());

  await confirmEmailVerification(session.customerId, code);

  return ok({ emailVerified: true });
});
