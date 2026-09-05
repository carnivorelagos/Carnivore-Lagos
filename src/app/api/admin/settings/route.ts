import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminSettingsUpdateSchema } from "@/lib/validation";
import { getSettingsFresh, SETTINGS_ID } from "@/lib/settings";
import { revalidateCatalog } from "@/lib/cache";

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  // Fresh, not the cached storefront read — an admin editing settings must
  // always see the true current row.
  const settings = await getSettingsFresh();
  return ok(settings);
});

/**
 * This is where the real deliveryRatePerKmKobo and minDeliveryFeeKobo get
 * set once confirmed with the client — both default to 0 until then, per
 * the resolved delivery-model decision.
 */
export const PATCH = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const data = adminSettingsUpdateSchema.parse(await req.json());

  await prisma.restaurantSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, restaurantName: "My Restaurant", ...data },
  });

  // Drop the cached storefront copy so /api/settings/public and every
  // checkout quote pick the change up immediately.
  revalidateCatalog("settings");

  const settings = await getSettingsFresh();
  return ok(settings);
});
