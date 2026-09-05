import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { notFound } from "@/lib/errors";

const SELECT = {
  id: true,
  phone: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  orderUpdatesOptOut: true,
  createdAt: true,
} as const;

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: SELECT,
  });
  if (!customer) throw notFound("Customer");
  return ok(customer);
});

const patchSchema = z.object({
  orderUpdatesOptOut: z.boolean().optional(),
});

/** Self-service profile preferences. Only the opt-out flag for now. */
export const PATCH = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const data = patchSchema.parse(await req.json());
  const customer = await prisma.customer.update({
    where: { id: session.customerId },
    data,
    select: SELECT,
  });
  return ok(customer);
});
