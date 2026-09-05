import { prisma } from "./prisma";
import type { SettingsInput } from "./checkout";
import { CACHE_TAGS, SETTINGS_REVALIDATE_SECONDS, cachedRead } from "./cache";

export const SETTINGS_ID = "default";

export type ResolvedSettings = SettingsInput & {
  restaurantName: string;
  autoConfirmPaidOrders: boolean;
};

/**
 * Sensible defaults for the (rare) case where the singleton row does not
 * exist yet — a brand-new database that has been migrated but not seeded,
 * or the very first request racing the first admin save. Delivery is off
 * because there is no configured origin to measure distance from; pickup
 * stays on so the store is still usable. We deliberately do NOT write the
 * row from this read path (that was a per-request `upsert` — a write and a
 * row lock on the hot checkout path). The row is created by the seed and
 * by the admin settings PATCH.
 */
const DEFAULT_SETTINGS: ResolvedSettings = {
  restaurantName: "My Restaurant",
  originLat: null,
  originLng: null,
  deliveryRatePerKmKobo: 0,
  minDeliveryFeeKobo: 0,
  maxDeliveryDistanceKm: null,
  pickupEnabled: true,
  deliveryEnabled: false,
  autoConfirmPaidOrders: true,
};

async function readSettingsFromDb(): Promise<ResolvedSettings> {
  const row = await prisma.restaurantSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!row) return DEFAULT_SETTINGS;

  return {
    restaurantName: row.restaurantName,
    originLat: row.originLat === null ? null : Number(row.originLat),
    originLng: row.originLng === null ? null : Number(row.originLng),
    deliveryRatePerKmKobo: row.deliveryRatePerKmKobo,
    minDeliveryFeeKobo: row.minDeliveryFeeKobo,
    maxDeliveryDistanceKm: row.maxDeliveryDistanceKm === null ? null : Number(row.maxDeliveryDistanceKm),
    pickupEnabled: row.pickupEnabled,
    deliveryEnabled: row.deliveryEnabled,
    autoConfirmPaidOrders: row.autoConfirmPaidOrders,
  };
}

const readSettingsCached = cachedRead(readSettingsFromDb, ["restaurant-settings", "v1"], {
  tags: [CACHE_TAGS.settings],
  revalidate: SETTINGS_REVALIDATE_SECONDS,
});

/**
 * RestaurantSettings is a singleton — always id="default". Converts
 * Prisma's Decimal fields to plain numbers so the rest of the app (and
 * computeCheckout, which is DB-independent by design) never has to know
 * Prisma's Decimal type exists.
 *
 * Cached: the row changes only on an admin save, which calls
 * `revalidateCatalog("settings")`. Every quote and every order used to
 * hit the DB for this.
 */
export async function getSettings(): Promise<ResolvedSettings> {
  return readSettingsCached();
}

/** Uncached read — use only where you must observe a write you just made. */
export async function getSettingsFresh(): Promise<ResolvedSettings> {
  return readSettingsFromDb();
}
