/**
 * Seeds the database from prisma/seed-data/dataset.json (generated from Nigerian_Foods_Dataset_v2.xlsx).
 *
 * Safe to re-run: it only CREATES missing rows (matched by Food.code and Recipe.legacyNo) and never
 * overwrites content that a dietitian or content manager may already have edited.
 */
import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  AnimalFlesh, CostTier, Difficulty, EvidenceLevel, FrequencyGuide, MappingStatus, PrismaClient, Role, SpiceLevel,
} from '@prisma/client';
import dataset from './seed-data/dataset.json';

const prisma = new PrismaClient();

interface Alias { language: string; name: string }
interface FoodRow {
  code: string; name: string; category: string; forms: string | null; botanicalName: string | null;
  allergenNote: string | null; searchKey1: string | null; searchKey2: string | null; referenceForm: string | null; aliases: Alias[];
}
interface RecipeRow {
  legacyNo: number; slug: string; name: string; category: string; originNote: string; summaryIngredients: string;
  timeText: string; totalMinutes: number | null; difficulty: Difficulty; servings: number; healthBenefits: string;
  keyNutrients: string; cautions: string; servedWith: string; occasion: string; cuisine: string; region: string;
  mealSlot: string; cookingMethod: string; spiceLevel: SpiceLevel; costTier: CostTier; allergenFlags: string[];
  containsAnimalFlesh: AnimalFlesh; frequencyGuide: FrequencyGuide; storageGuidance: string; evidenceLevel: EvidenceLevel;
  tips: string; aliases: Alias[];
  ingredientLines: { position: number; rawText: string; optional: boolean }[];
  steps: { stepNumber: number; instruction: string }[];
}
const data = dataset as unknown as {
  nutrients: { key: string; name: string; unit: string; sortOrder: number }[];
  foods: FoodRow[];
  recipes: RecipeRow[];
};

const SOURCES = [
  { title: 'Nigerian Food Composition Table', publisher: 'University of Ibadan (listed by FAO/INFOODS)', publicationYear: 2017 },
  { title: 'FAO/INFOODS Western Africa Food Composition Table', publisher: 'FAO / INFOODS', publicationYear: 2019 },
  { title: 'Nigerian Food-Based Dietary Guidelines', publisher: 'FAO (Nigeria)', publicationYear: 2001 },
  { title: 'Nutrient Composition of Commonly Eaten Foods in Nigeria: Raw, Processed and Prepared', publisher: 'Food Basket Foundation International, Ibadan', publicationYear: 1995 },
  { title: 'National Food Consumption and Micronutrient Survey (2021)', publisher: 'Federal Government of Nigeria / IITA', publicationYear: 2024 },
];

async function ensureUser(email: string, name: string, role: Role, password: string | undefined) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;
  const pw = password || crypto.randomBytes(12).toString('base64url');
  await prisma.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true } });
  console.log(`Created ${role} ${email}${password ? '' : `  (generated password: ${pw})`}`);
}

async function main() {
  await ensureUser(process.env.SEED_ADMIN_EMAIL || 'admin@example.com', 'Administrator', Role.SUPER_ADMIN, process.env.SEED_ADMIN_PASSWORD);
  await ensureUser(process.env.SEED_REVIEWER_EMAIL || 'dietitian@example.com', 'Dietitian (placeholder)', Role.NUTRITION_REVIEWER, process.env.SEED_REVIEWER_PASSWORD);

  for (const n of data.nutrients) {
    await prisma.nutrient.upsert({ where: { key: n.key }, create: n, update: { name: n.name, unit: n.unit, sortOrder: n.sortOrder } });
  }

  for (const s of SOURCES) {
    if (!(await prisma.knowledgeSource.findFirst({ where: { title: s.title } }))) {
      await prisma.knowledgeSource.create({ data: { ...s, licenseNote: 'Permission to reuse/redistribute not yet confirmed. Obtain in writing before importing values.' } });
    }
  }

  let foodsCreated = 0;
  for (const f of data.foods) {
    if (await prisma.food.findUnique({ where: { code: f.code } })) continue;
    await prisma.food.create({
      data: {
        code: f.code, name: f.name, category: f.category, forms: f.forms, botanicalName: f.botanicalName,
        allergenNote: f.allergenNote, referenceForm: f.referenceForm, searchKey1: f.searchKey1, searchKey2: f.searchKey2,
        aliases: { create: f.aliases },
      },
    });
    foodsCreated++;
  }

  // Index foods by search key for the automatic ingredient-line suggestions (a reviewer confirms them later).
  const foods = await prisma.food.findMany({ select: { id: true, searchKey1: true, searchKey2: true } });
  const keyed = foods.map((f) => ({ id: f.id, keys: [f.searchKey1, f.searchKey2].filter((k): k is string => !!k).map((k) => k.toLowerCase()) }));

  let recipesCreated = 0, linesCreated = 0, linesSuggested = 0;
  for (const r of data.recipes) {
    if (await prisma.recipe.findUnique({ where: { legacyNo: r.legacyNo } })) continue;
    await prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: {
          legacyNo: r.legacyNo, slug: r.slug, name: r.name, category: r.category, originNote: r.originNote, cuisine: r.cuisine,
          region: r.region, mealSlot: r.mealSlot, cookingMethod: r.cookingMethod, spiceLevel: r.spiceLevel, costTier: r.costTier,
          summaryIngredients: r.summaryIngredients, timeText: r.timeText, totalMinutes: r.totalMinutes, difficulty: r.difficulty,
          servings: r.servings, healthBenefits: r.healthBenefits, keyNutrients: r.keyNutrients, cautions: r.cautions,
          frequencyGuide: r.frequencyGuide, allergenFlags: r.allergenFlags, containsAnimalFlesh: r.containsAnimalFlesh,
          servedWith: r.servedWith, occasion: r.occasion, storageGuidance: r.storageGuidance, tips: r.tips,
          evidenceLevel: r.evidenceLevel,
          aliases: { create: r.aliases },
          steps: { create: r.steps },
        },
      });
      for (const line of r.ingredientLines) {
        const haystack = ' ' + line.rawText.toLowerCase();
        const ids = keyed.filter((f) => f.keys.some((k) => haystack.includes(k))).map((f) => ({ id: f.id }));
        await tx.recipeIngredientLine.create({
          data: {
            recipeId: recipe.id, position: line.position, rawText: line.rawText, optional: line.optional,
            mappingStatus: ids.length ? MappingStatus.AUTO_SUGGESTED : MappingStatus.UNMAPPED,
            foods: { connect: ids },
          },
        });
        linesCreated++;
        if (ids.length) linesSuggested++;
      }
    });
    recipesCreated++;
  }

  console.log(`Seed complete: ${foodsCreated} foodstuffs, ${recipesCreated} dishes, ${linesCreated} ingredient lines (${linesSuggested} auto-suggested, ${linesCreated - linesSuggested} unmapped).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
