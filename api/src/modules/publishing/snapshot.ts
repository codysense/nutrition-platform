import { createHash } from 'crypto';

/** The fields of a dish that end up in a published snapshot. Internal fields (editors, comments, status) are deliberately absent. */
export interface SnapshotSource {
  slug: string; name: string; category: string; originNote: string | null; cuisine: string | null; region: string | null;
  mealSlot: string | null; cookingMethod: string | null; spiceLevel: string | null; costTier: string | null;
  summaryIngredients: string | null; timeText: string | null; totalMinutes: number | null; difficulty: string | null;
  servings: number | null; healthBenefits: string | null; keyNutrients: string | null; cautions: string | null;
  frequencyGuide: string | null; allergenFlags: string[]; containsAnimalFlesh: string | null; servedWith: string | null;
  occasion: string | null; storageGuidance: string | null; tips: string | null; evidenceLevel: string; namesVerified: boolean;
  aliases: { language: string; name: string; verified: boolean }[];
  steps: { stepNumber: number; instruction: string }[];
  lines: {
    position: number; rawText: string; optional: boolean; mappingStatus: string; role: string; roleConfirmed: boolean;
    foods: { id: string; name: string; category: string; aliases: { language: string; name: string }[] }[];
  }[];
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Builds the snapshot content. Everything is sorted and keys are written in a fixed order, so the same dish always
 * produces byte-identical JSON and therefore the same hash. That is what makes "has the working copy changed since
 * it went live?" a reliable question.
 */
export function snapshotContent(r: SnapshotSource) {
  return {
    slug: r.slug, name: r.name, category: r.category, originNote: r.originNote, cuisine: r.cuisine, region: r.region,
    mealSlot: r.mealSlot, cookingMethod: r.cookingMethod, spiceLevel: r.spiceLevel, costTier: r.costTier,
    summaryIngredients: r.summaryIngredients, timeText: r.timeText, totalMinutes: r.totalMinutes, difficulty: r.difficulty,
    servings: r.servings, healthBenefits: r.healthBenefits, keyNutrients: r.keyNutrients, cautions: r.cautions,
    frequencyGuide: r.frequencyGuide, allergenFlags: [...r.allergenFlags].sort(byText), containsAnimalFlesh: r.containsAnimalFlesh,
    servedWith: r.servedWith, occasion: r.occasion, storageGuidance: r.storageGuidance, tips: r.tips,
    evidenceLevel: r.evidenceLevel, namesVerified: r.namesVerified,
    aliases: [...r.aliases]
      .sort((a, b) => byText(a.language + a.name, b.language + b.name))
      .map((a) => ({ language: a.language, name: a.name, verified: a.verified })),
    steps: [...r.steps].sort((a, b) => a.stepNumber - b.stepNumber).map((s) => ({ stepNumber: s.stepNumber, instruction: s.instruction })),
    ingredientLines: [...r.lines]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        position: l.position, rawText: l.rawText, optional: l.optional, mappingStatus: l.mappingStatus, role: l.role, roleConfirmed: l.roleConfirmed,
        foods: [...l.foods]
          .sort((a, b) => byText(a.id, b.id))
          .map((f) => ({
            id: f.id, name: f.name, category: f.category,
            aliases: [...f.aliases].sort((a, b) => byText(a.language + a.name, b.language + b.name)).map((a) => ({ language: a.language, name: a.name })),
          })),
      })),
  };
}

export type SnapshotContent = ReturnType<typeof snapshotContent>;

export const hashContent = (c: SnapshotContent) => createHash('sha256').update(JSON.stringify(c)).digest('hex');

/** Share of ingredient lines whose foodstuff links a person has confirmed (0 to 1). Used for the "x% confirmed" indicator. */
export function confirmedShare(lines: { mappingStatus: string }[]): number {
  return lines.length === 0 ? 0 : lines.filter((l) => l.mappingStatus === 'CONFIRMED').length / lines.length;
}
