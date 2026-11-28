import { describe, expect, it } from 'vitest';
import { confirmedShare, hashContent, snapshotContent, SnapshotSource } from './snapshot';

const dish = (): SnapshotSource => ({
  slug: 'jollof-rice', name: 'Jollof Rice', category: 'Rice dish', originNote: null, cuisine: 'Pan-Nigerian', region: 'Nationwide',
  mealSlot: null, cookingMethod: null, spiceLevel: 'MEDIUM', costTier: 'MEDIUM', summaryIngredients: null, timeText: '1 hr', totalMinutes: 60,
  difficulty: 'MEDIUM', servings: 6, healthBenefits: 'Provides energy.', keyNutrients: null, cautions: null, frequencyGuide: 'OCCASIONAL',
  allergenFlags: ['Milk (optional)', 'Fish'], containsAnimalFlesh: 'YES', servedWith: null, occasion: null, storageGuidance: null, tips: null,
  evidenceLevel: 'C_COMMUNITY', namesVerified: false,
  aliases: [{ language: 'yoruba', name: 'Iresi', verified: false }, { language: 'hausa', name: 'Shinkafa', verified: true }],
  steps: [{ stepNumber: 2, instruction: 'Fry' }, { stepNumber: 1, instruction: 'Wash' }],
  lines: [
    { position: 2, rawText: 'onions', optional: false, mappingStatus: 'CONFIRMED', role: 'CORE', roleConfirmed: true, foods: [{ id: 'f2', name: 'Onion', category: 'Other vegetables', aliases: [{ language: 'hausa', name: 'Albasa' }, { language: 'yoruba', name: 'Alubosa' }] }] },
    { position: 1, rawText: 'rice', optional: false, mappingStatus: 'AUTO_SUGGESTED', role: 'CORE', roleConfirmed: false, foods: [{ id: 'f1', name: 'Rice', category: 'Grains & cereals', aliases: [] }] },
  ],
});
const hash = (d: SnapshotSource) => hashContent(snapshotContent(d));

describe('published snapshot', () => {
  it('is deterministic and ignores input ordering', () => {
    const shuffled = dish();
    shuffled.aliases.reverse(); shuffled.steps.reverse(); shuffled.lines.reverse(); shuffled.allergenFlags.reverse();
    expect(hash(shuffled)).toBe(hash(dish()));
  });
  it('changes when a claim, allergen, step, name verification, ingredient link or role changes', () => {
    const base = hash(dish());
    const claim = dish(); claim.healthBenefits = 'Something else.';
    const allergen = dish(); allergen.allergenFlags.push('Egg');
    const step = dish(); step.steps[0].instruction = 'Fry longer';
    const verified = dish(); verified.aliases[0].verified = true;
    const confirm = dish(); confirm.lines.find((l) => l.position === 1)!.mappingStatus = 'CONFIRMED';
    const link = dish(); link.lines[0].foods.push({ id: 'f9', name: 'Salt', category: 'Herbs, spices & seasonings', aliases: [] });
    const role = dish(); role.lines.find((l) => l.position === 2)!.role = 'SEASONING';
    for (const changed of [claim, allergen, step, verified, confirm, link, role]) expect(hash(changed)).not.toBe(base);
  });
  it('does not change when an already confirmed line is confirmed again', () => {
    const again = dish(); again.lines.find((l) => l.position === 2)!.mappingStatus = 'CONFIRMED';
    expect(hash(again)).toBe(hash(dish()));
  });
  it('never includes internal fields', () => {
    const json = JSON.stringify(snapshotContent({ ...dish(), lastEditedById: 'u1', status: 'PUBLISHED', comments: [{ body: 'secret' }] } as SnapshotSource));
    expect(json).not.toMatch(/lastEditedById|"status"|comments|secret/);
  });
  it('reports the share of confirmed ingredient lines', () => {
    expect(confirmedShare(dish().lines)).toBe(0.5);
    expect(confirmedShare([])).toBe(0);
  });
});
