/**
 * Development-only seed data (Section 43). Guarded so it can never run
 * against a live database by accident (Section 23):
 *
 *   1. Refuses outright if NODE_ENV === "production".
 *   2. Additionally requires SEED_CONFIRM="yes-seed-dev-db" to be set —
 *      an env var that must never exist in the production environment's
 *      configuration (Netlify env vars, etc). Two independent switches
 *      have to agree before anything is written.
 *
 * The real production admin account is a separate, one-time process —
 * see DEPLOYMENT.md "Creating the production admin account". This script
 * is never that process.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hashPassword } from "../src/lib/auth/password";

function assertSafeToSeed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV=production.");
  }
  if (process.env.SEED_CONFIRM !== "yes-seed-dev-db") {
    throw new Error(
      'Refusing to seed: set SEED_CONFIRM="yes-seed-dev-db" in your local .env to confirm this is a throwaway dev database.',
    );
  }
}

async function main() {
  assertSafeToSeed();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const devEmail = process.env.SEED_ADMIN_EMAIL ?? "dev-admin@example.com";
  const devPassword = process.env.SEED_ADMIN_PASSWORD ?? "dev-only-password-123";

  await prisma.adminUser.upsert({
    where: { email: devEmail },
    update: {},
    create: {
      email: devEmail,
      passwordHash: await hashPassword(devPassword),
      role: "SUPER_ADMIN",
    },
  });
  console.log(`Seeded dev admin: ${devEmail} / ${devPassword} (change immediately if this is ever exposed)`);

  await prisma.restaurantSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      restaurantName: "Sample Restaurant",
      originLat: 6.5244,
      originLng: 3.3792,
      deliveryRatePerKmKobo: 0,
      minDeliveryFeeKobo: 0,
      maxDeliveryDistanceKm: 15,
      pickupEnabled: true,
      deliveryEnabled: true,
    },
  });

  // The two old demo products are removed so the live menu is exactly the
  // Carnivore Lagos menu below (no leftover placeholder items). Deleting by
  // fixed id is idempotent (a no-op once already removed) and safe for
  // historical data: OrderItem.productId is nullable with onDelete: SetNull
  // and OrderItem snapshots productNameSnapshot/unitPriceKobo, so any past
  // order referencing these demo products keeps its accurate historical
  // record even after the Product row is gone.
  await prisma.product.deleteMany({
    where: {
      id: {
        in: [
          "00000000-0000-0000-0000-000000000001",
          "00000000-0000-0000-0000-000000000002",
        ],
      },
    },
  });
  // The old demo "Mains" category is no longer used by any product above;
  // removing it is likewise idempotent (matches 0 rows on reruns).
  await prisma.category.deleteMany({ where: { name: "Mains" } });

  // Carnivore Lagos live menu. Categories are created/used in the exact
  // order given by the client. Every product carries a fixed id so the
  // upsert below is idempotent — reseeding never creates duplicates.
  const CATEGORIES = [
    { key: "carnivoreGrill", name: "Grill", sortOrder: 1 },
    { key: "mealComboSides", name: "Combos & Sides", sortOrder: 2 },
    { key: "shawarma", name: "Shawarma", sortOrder: 3 },
    { key: "drinks", name: "Drinks", sortOrder: 4 },
    { key: "smoothies", name: "Smoothies", sortOrder: 5 },
    { key: "cocktails", name: "Cocktails", sortOrder: 6 },
    { key: "mocktails", name: "Mocktails", sortOrder: 7 },
    { key: "pepperSoup", name: "Pepper Soup", sortOrder: 8 },
  ] as const;

  const categoryIdByKey = new Map<string, string>();
  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { name: c.name },
      update: { sortOrder: c.sortOrder },
      create: { name: c.name, sortOrder: c.sortOrder },
    });
    categoryIdByKey.set(c.key, category.id);
  }

  // Naira prices are converted to integer kobo by multiplying by 100
  // (e.g. ₦8,000 -> 800000 kobo), per the client's price-conversion table.
  //
  // NOTE: the client's list also mentions "Quarter Chicken ₦4,000" next to
  // Half Chicken Suya. The schema has no product-variant/option model, so
  // per explicit instruction that is NOT created as a separate product —
  // Half Chicken Suya remains a single ₦8,000 / 800000 kobo product.
  const PRODUCTS = [
    // Carnivore Grill (16)
    { id: "00000000-0000-0000-0000-000000000101", category: "carnivoreGrill", name: "Half Chicken Suya", description: "Well-seasoned half chicken suya.", priceKobo: 800000 },
    { id: "00000000-0000-0000-0000-000000000102", category: "carnivoreGrill", name: "Half Guinea Fowl Suya", description: "Deliciously seasoned with yaji.", priceKobo: 900000 },
    { id: "00000000-0000-0000-0000-000000000103", category: "carnivoreGrill", name: "Grilled Chicken Wings", description: "Well-seasoned grilled chicken wings.", priceKobo: 120000 },
    { id: "00000000-0000-0000-0000-000000000104", category: "carnivoreGrill", name: "Asun", description: "200g of well-seasoned goat meat.", priceKobo: 900000 },
    { id: "00000000-0000-0000-0000-000000000105", category: "carnivoreGrill", name: "Beef Tozo", description: "Well-seasoned slow-grilled beef tozo.", priceKobo: 150000 },
    { id: "00000000-0000-0000-0000-000000000106", category: "carnivoreGrill", name: "Balangu / Ram Suya", description: "200g of well-seasoned slow-grilled ram meat.", priceKobo: 900000 },
    { id: "00000000-0000-0000-0000-000000000107", category: "carnivoreGrill", name: "Jumbo Turkey Wing Suya", description: "Delicious grilled turkey seasoned with yaji.", priceKobo: 700000 },
    { id: "00000000-0000-0000-0000-000000000108", category: "carnivoreGrill", name: "Gizzard Suya", description: "Well-seasoned grilled gizzard.", priceKobo: 150000 },
    { id: "00000000-0000-0000-0000-000000000109", category: "carnivoreGrill", name: "Kidney Suya", description: "Well-seasoned grilled kidney.", priceKobo: 150000 },
    { id: "00000000-0000-0000-0000-000000000110", category: "carnivoreGrill", name: "Fish Suya", description: "Tasty grilled croaker or tilapia fish.", priceKobo: 1100000 },
    { id: "00000000-0000-0000-0000-000000000111", category: "carnivoreGrill", name: "Pepper Snail", description: "Delicious giant pepper snail, 200g.", priceKobo: 1100000 },
    { id: "00000000-0000-0000-0000-000000000112", category: "carnivoreGrill", name: "Chicken Lap Suya", description: "Grilled chicken lap seasoned with yaji.", priceKobo: 450000 },
    { id: "00000000-0000-0000-0000-000000000113", category: "carnivoreGrill", name: "Giant Prawn Suya", description: "Delicious prawn suya served with corn.", priceKobo: 1250000 },
    { id: "00000000-0000-0000-0000-000000000114", category: "carnivoreGrill", name: "Steak", description: "Slow-grilled steak served with sautéed vegetables, 200g.", priceKobo: 1250000 },
    { id: "00000000-0000-0000-0000-000000000115", category: "carnivoreGrill", name: "Tomahawk", description: "Slow-grilled Tomahawk served with sautéed vegetables and corn.", priceKobo: 4500000 },
    { id: "00000000-0000-0000-0000-000000000116", category: "carnivoreGrill", name: "Carnivore Platter", description: "Any 6-combo platter serving 10 people.", priceKobo: 6000000 },

    // Meal Combo & Sides (11)
    { id: "00000000-0000-0000-0000-000000000201", category: "mealComboSides", name: "Mixed Rice Combo", description: "Jollof, fried or mixed rice served with chicken and plantain.", priceKobo: 450000 },
    { id: "00000000-0000-0000-0000-000000000202", category: "mealComboSides", name: "Jollof Rice and Chicken Wings", description: "Smoky jollof rice and chicken wings.", priceKobo: 400000 },
    { id: "00000000-0000-0000-0000-000000000203", category: "mealComboSides", name: "Fried Rice and Chicken Wings", description: "Fried rice and chicken wings.", priceKobo: 400000 },
    { id: "00000000-0000-0000-0000-000000000204", category: "mealComboSides", name: "Ram Suya Indomie", description: "Stir-fry Indomie mixed with ram suya.", priceKobo: 450000 },
    { id: "00000000-0000-0000-0000-000000000205", category: "mealComboSides", name: "Ram Suya Pasta", description: "Ram suya with stir-fry spaghetti.", priceKobo: 550000 },
    { id: "00000000-0000-0000-0000-000000000206", category: "mealComboSides", name: "Stir-fry Spaghetti and Chicken Wings", description: "Delicious stir-fry spaghetti mixed with vegetables and chicken wings.", priceKobo: 450000 },
    { id: "00000000-0000-0000-0000-000000000207", category: "mealComboSides", name: "Native Rice", description: "Delicious native rice with smoked fish.", priceKobo: 400000 },
    { id: "00000000-0000-0000-0000-000000000208", category: "mealComboSides", name: "Gizdodo", description: "Tender gizzard with plantain in pepper-tomato sauce mixed with vegetables.", priceKobo: 400000 },
    { id: "00000000-0000-0000-0000-000000000209", category: "mealComboSides", name: "Bolognese Spaghetti", description: "Sautéed spaghetti with minced meat in rich tomato sauce.", priceKobo: 800000 },
    { id: "00000000-0000-0000-0000-000000000210", category: "mealComboSides", name: "Chicken Salad", description: "Delicious chicken salad.", priceKobo: 500000 },
    { id: "00000000-0000-0000-0000-000000000211", category: "mealComboSides", name: "Coconut Rice", description: "Delicious coconut rice with chicken wings.", priceKobo: 650000 },

    // Shawarma (4)
    { id: "00000000-0000-0000-0000-000000000301", category: "shawarma", name: "Chicken Shawarma", description: "Spiced, grilled and sliced chicken strips.", priceKobo: 450000 },
    { id: "00000000-0000-0000-0000-000000000302", category: "shawarma", name: "Ram Suya Shawarma", description: "Creamy shawarma with a piece of hotdog and tasty ram suya.", priceKobo: 450000 },
    { id: "00000000-0000-0000-0000-000000000303", category: "shawarma", name: "Mixed Shawarma", description: "Creamy shawarma with a piece of hotdog, chicken and beef.", priceKobo: 450000 },
    { id: "00000000-0000-0000-0000-000000000304", category: "shawarma", name: "Beef Shawarma", description: "Delicious beef shawarma mixed with a piece of hotdog.", priceKobo: 400000 },

    // Drinks (1)
    { id: "00000000-0000-0000-0000-000000000401", category: "drinks", name: "Milkshake", description: "Chocolate, vanilla, strawberry, Oreo, banana, Oreo caramel, or strawberry banana milkshake.", priceKobo: 700000 },

    // Smoothies (6)
    { id: "00000000-0000-0000-0000-000000000501", category: "smoothies", name: "Banana, Orange and Pineapple Smoothie", description: "Banana, orange and pineapple smoothie.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000502", category: "smoothies", name: "Carrot and Pineapple Detox Smoothie", description: "Carrot and pineapple detox smoothie.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000503", category: "smoothies", name: "Avocado, Banana and Pear Smoothie", description: "Avocado, banana and pear smoothie.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000504", category: "smoothies", name: "Pineapple, Coconut and Banana Smoothie", description: "Pineapple, coconut and banana smoothie.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000505", category: "smoothies", name: "Watermelon, Pineapple and Ginger Smoothie", description: "Watermelon, pineapple and ginger smoothie.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000506", category: "smoothies", name: "Peanut Butter Banana Smoothie", description: "Peanut butter and banana smoothie.", priceKobo: 600000 },

    // Cocktails (3)
    { id: "00000000-0000-0000-0000-000000000601", category: "cocktails", name: "Long Island", description: "Long Island cocktail.", priceKobo: 800000 },
    { id: "00000000-0000-0000-0000-000000000602", category: "cocktails", name: "Pina Colada", description: "Pina colada cocktail.", priceKobo: 800000 },
    { id: "00000000-0000-0000-0000-000000000603", category: "cocktails", name: "Mojito", description: "Mojito cocktail.", priceKobo: 800000 },

    // Mocktails (3)
    { id: "00000000-0000-0000-0000-000000000701", category: "mocktails", name: "Chapman", description: "Chapman mocktail.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000702", category: "mocktails", name: "Virgin Mojito", description: "Virgin mojito.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000703", category: "mocktails", name: "Virgin Colada", description: "Virgin colada.", priceKobo: 600000 },

    // Pepper Soup (5)
    { id: "00000000-0000-0000-0000-000000000801", category: "pepperSoup", name: "Goat Meat Pepper Soup", description: "Delicious pepper soup served with yam, plantain or white rice.", priceKobo: 900000 },
    { id: "00000000-0000-0000-0000-000000000802", category: "pepperSoup", name: "Turkey Pepper Soup", description: "Delicious pepper soup served with yam, white rice or plantain.", priceKobo: 700000 },
    { id: "00000000-0000-0000-0000-000000000803", category: "pepperSoup", name: "Chicken Pepper Soup", description: "Delicious pepper soup served with plantain, yam or white rice.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000804", category: "pepperSoup", name: "Croaker Fish Pepper Soup", description: "Delicious pepper soup served with yam, plantain or white rice.", priceKobo: 600000 },
    { id: "00000000-0000-0000-0000-000000000805", category: "pepperSoup", name: "Catfish Pepper Soup", description: "Delicious pepper soup served with yam, plantain or white rice.", priceKobo: 600000 },
  ] as const;

  // Attribute tags drive the smart search / concierge. Derived from the
  // name + category so the seed stays readable; admins refine per product
  // in the dashboard afterwards.
  const tagsFor = (name: string, category: string): string[] => {
    const n = name.toLowerCase();
    const t = new Set<string>();
    if (/suya|yaji|pepper|asun|balangu/.test(n)) t.add("spicy");
    if (/suya|grill|balangu|asun|tozo|steak|tomahawk|wing/.test(n)) t.add("grilled");
    if (/beef|goat|ram|asun|tozo|steak|tomahawk|suya|turkey|guinea|chicken lap|half chicken/.test(n)) t.add("meaty");
    if (/fish|prawn|snail|croaker|catfish|tilapia/.test(n)) t.add("seafood");
    if (/salad|smoothie|detox|soup|mocktail|virgin/.test(n)) t.add("light");
    if (/platter|combo/.test(n)) t.add("shareable");
    if (/rice|pasta|spaghetti|indomie|noodle/.test(n)) t.add("rice-and-sides");
    if (category === "drinks" || category === "smoothies" || category === "cocktails" || category === "mocktails") t.add("drink");
    if (category === "cocktails") t.add("alcohol");
    if (category === "pepperSoup") { t.add("spicy"); t.add("soup"); }
    if (category === "shawarma") t.add("wrap");
    return [...t];
  };

  for (const p of PRODUCTS) {
    const categoryId = categoryIdByKey.get(p.category);
    if (!categoryId) throw new Error(`Unknown category key: ${p.category}`);
    const tags = tagsFor(p.name, p.category);
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        description: p.description,
        priceKobo: p.priceKobo,
        categoryId,
        imageUrl: null,
        isActive: true,
        isAvailable: true,
        tags,
      },
      create: {
        id: p.id,
        name: p.name,
        description: p.description,
        priceKobo: p.priceKobo,
        categoryId,
        imageUrl: null,
        isActive: true,
        isAvailable: true,
        tags,
      },
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories and ${PRODUCTS.length} products (Carnivore Lagos menu).`);
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
