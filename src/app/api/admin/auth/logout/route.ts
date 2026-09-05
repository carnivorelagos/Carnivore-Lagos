import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { clearSessionCookie } from "@/lib/auth/session";

export const POST = withApiHandler(async (_req: NextRequest) => {
  const response = ok({ loggedOut: true });
  clearSessionCookie(response);
  return response;
});
