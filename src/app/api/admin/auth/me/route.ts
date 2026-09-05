import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireAdmin(req);
  return ok({ id: session.adminId, email: session.email, role: session.role });
});
