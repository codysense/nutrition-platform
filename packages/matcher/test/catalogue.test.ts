import { describe, expect, it } from 'vitest';
import { buildCatalogue, looksLikeAlternatives, SnapshotLike } from '../src';

const snap = (over: Partial<SnapshotLike> = {}): SnapshotLike => ({
  slug: 'x', name: 'X', category: 'Main dish', cuisine: 'Yoruba', mealSlot: null, costTier: 'LOW', spiceLevel: null, totalMinutes: 30,
  allergenFlags: [], containsAnimalFlesh: 'NO', aliases: [],
  ingredientLines: [
    { position: 1, rawText: '500g beef or chicken', role: 'CORE', foods: [{ id: 'b', name: 'Beef', category: 'Meat & poultry', aliases: [] }, { id: 'c', name: 'Chicken', category: 'Meat & poultry', aliases: [] }] },
    { position: 2, rawText: 'Salt to taste', role: 'STAPLE', foods: [{ id: 's', name: 'Salt', category: 'Herbs, spices & seasonings', aliases: [] }] },
    { position: 3, rawText: 'Something odd', role: 'WEIRD', foods: [{ id: 'b', name: 'Beef', category: 'Meat & poultry', aliases: [] }] },
  ],
  ...over,
});

describe('buildCatalogue', () => {
  it('detects lines that list alternatives', () => {
    expect(looksLikeAlternatives('500g beef or chicken')).toBe(true);
    expect(looksLikeAlternatives('1 tsp potash/kaun')).toBe(true);
    expect(looksLikeAlternatives('3 cups rice')).toBe(false);
  });
  it('builds dishes and a de-duplicated food list from snapshots', () => {
    const c = buildCatalogue('v1', [{ id: 'd1', content: snap() }, { id: 'd2', content: snap({ slug: 'y', name: 'Y' }) }]);
    expect(c.version).toBe('v1');
    expect(c.dishes).toHaveLength(2);
    expect(c.foods.map((f) => f.id).sort()).toEqual(['b', 'c', 's']);
  });
  it('marks any-of lines, flags staple foods, and defaults an unknown role to core (the strict side)', () => {
    const c = buildCatalogue('v1', [{ id: 'd1', content: snap() }]);
    const [l1, , l3] = c.dishes[0].lines;
    expect(l1.anyOf).toBe(true);
    expect(c.foods.find((f) => f.id === 's')?.staple).toBe(true);
    expect(c.foods.find((f) => f.id === 'b')?.staple).toBe(false);
    expect(l3.role).toBe('CORE');
  });
});
