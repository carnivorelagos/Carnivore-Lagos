import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { clearCustomerSessionCookie } from "@/lib/auth/customerSession";

export const POST = withApiHandler(async (_req: NextRequest) => {
  const response = ok({ loggedOut: true });
  clearCustomerSessionCookie(response);
  return response;
});
