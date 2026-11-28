/**
 * Builds packages/matcher/test/catalogue.fixture.json from the seed dataset, simulating a fully reviewed and published
 * catalogue: every ingredient line is linked (by the same search keys the seed uses) and given its suggested role, then
 * passed through the real snapshotContent() and the matcher's buildCatalogue(). Run: npx tsx scripts/make-catalogue-fixture.ts
 */
import fs from 'fs';
import path from 'path';
import { suggestRole } from '../src/modules/ingredients/roles';
import { snapshotContent } from '../src/modules/publishing/snapshot';
import { buildCatalogue } from '../../packages/matcher/src/catalogue';

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../prisma/seed-data/dataset.json'), 'utf8'));

const foods = data.foods.map((f: any) => ({
  id: f.code, name: f.name, category: f.category, aliases: f.aliases as { language: string; name: string }[],
  keys: [f.searchKey1, f.searchKey2].filter(Boolean).map((k: string) => k.toLowerCase()),
}));

const items = data.recipes.map((r: any) => {
  const lines = r.ingredientLines.map((l: any) => {
    const hay = ' ' + l.rawText.toLowerCase();
    const matched = foods.filter((f: any) => f.keys.some((k: string) => hay.includes(k)));
    return {
      position: l.position, rawText: l.rawText, optional: l.optional, mappingStatus: 'CONFIRMED', roleConfirmed: true,
      role: suggestRole({ rawText: l.rawText, optional: l.optional, foods: matched.map((f: any) => ({ name: f.name, category: f.category })) }),
      foods: matched.map((f: any) => ({ id: f.id, name: f.name, category: f.category, aliases: f.aliases })),
    };
  });
  const content = snapshotContent({
    slug: r.slug, name: r.name, category: r.category, originNote: r.originNote, cuisine: r.cuisine, region: r.region, mealSlot: r.mealSlot,
    cookingMethod: r.cookingMethod, spiceLevel: r.spiceLevel, costTier: r.costTier, summaryIngredients: r.summaryIngredients, timeText: r.timeText,
    totalMinutes: r.totalMinutes, difficulty: r.difficulty, servings: r.servings, healthBenefits: r.healthBenefits, keyNutrients: r.keyNutrients,
    cautions: r.cautions, frequencyGuide: r.frequencyGuide, allergenFlags: r.allergenFlags, containsAnimalFlesh: r.containsAnimalFlesh,
    servedWith: r.servedWith, occasion: r.occasion, storageGuidance: r.storageGuidance, tips: r.tips, evidenceLevel: r.evidenceLevel,
    namesVerified: false, aliases: r.aliases.map((a: any) => ({ ...a, verified: false })), steps: r.steps, lines,
  });
  return { id: `d${r.legacyNo}`, content };
});

const catalogue = buildCatalogue('fixture-v1', items);
const out = path.join(__dirname, '../../packages/matcher/test/catalogue.fixture.json');
fs.writeFileSync(out, JSON.stringify(catalogue));
console.log(`wrote ${out}: ${catalogue.dishes.length} dishes, ${catalogue.foods.length} foods, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
