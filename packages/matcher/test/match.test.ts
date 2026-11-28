import { describe, expect, it } from 'vitest';
import { Catalogue, DishMatch, explainMatch, matchDishes } from '../src';
import { dish, line, mini } from './helpers';

const cat = mini();
const byId = (r: DishMatch[], id: string) => r.find((m) => m.dishId === id);

describe('how lines count', () => {
  it('assumes staples (salt, water) so they never count as missing', () => {
    const r = matchDishes(cat, ['rice']);
    expect(byId(r, 'plain-rice')?.status).toBe('READY');
    expect(byId(r, 'plain-rice')?.matchPercent).toBe(100);
    expect(byId(r, 'plain-rice')?.assumedStaples).toContain('Clean water');
  });
  it('checks staples when asked, without turning them into missing core items', () => {
    const m = byId(matchDishes(cat, ['rice'], { staples: 'check' }), 'plain-rice')!;
    expect(m.status).toBe('READY');
    expect(m.matchPercent < 100).toBe(true);
    expect(m.missingCore).toHaveLength(0);
  });
  it('counts a seasoning for a quarter and ignores optional lines', () => {
    const m = byId(matchDishes(cat, ['beef', 'tomato', 'onion']), 'beef-stew')!;
    expect(m.status).toBe('READY'); // missing only the curry
    expect(m.matchPercent).toBe(94); // beef counts double as the defining ingredient: 4 / (4 + 0.25)
    expect(m.missingSeasoning).toHaveLength(1);
    expect(m.missingCore).toHaveLength(0);
  });
  it('gives partial credit for a line that lists several foods', () => {
    const m = byId(matchDishes(cat, ['tomato']), 'pepper-onion-sauce')!;
    expect(m.matchPercent).toBe(50);
    expect(m.missingCore[0].missing.map((x) => x.id)).toEqual(['onion']);
  });
  it('accepts any one of a list of alternatives', () => {
    expect(byId(matchDishes(cat, ['rice', 'beef']), 'chicken-or-beef-rice')?.status).toBe('READY');
    expect(byId(matchDishes(cat, ['rice', 'chicken']), 'chicken-or-beef-rice')?.status).toBe('READY');
    expect(byId(matchDishes(cat, ['rice']), 'chicken-or-beef-rice')?.status).toBe('ALMOST');
  });
});

describe('staple foods on mixed lines', () => {
  const mixed: Catalogue = { ...cat, dishes: [dish('mix', 'Mixed', [line(1, '3 cups rice', 'CORE', ['rice']), line(2, '1 tsp curry, salt to taste', 'SEASONING', ['curry', 'salt'])])] };
  it('assumes the salt on a line that also lists a real seasoning, so it is never listed as missing', () => {
    const m = matchDishes(mixed, ['rice', 'curry'])[0];
    expect(m.missingSeasoning).toHaveLength(0);
    expect(m.matchPercent).toBe(100);
  });
  it('lists the salt as missing only when asked to check staples', () => {
    const m = matchDishes(mixed, ['rice', 'curry'], { staples: 'check' })[0];
    expect(m.missingSeasoning[0].missing.map((x) => x.id)).toEqual(['salt']);
    expect(m.matchPercent).toBe(94);
  });
});

describe('the defining ingredient', () => {
  it('never calls a dish "almost" when its first core ingredient is missing', () => {
    // beef is missing but tomato and onion are present: only one core line missing, yet it is not "almost"
    const m = byId(matchDishes(cat, ['tomato', 'onion', 'curry']), 'beef-stew')!;
    expect(m.missingCore).toHaveLength(1);
    expect(m.status).toBe('PARTIAL');
  });
});

describe('ordering', () => {
  it('lists ready dishes before almost, and almost before partial', () => {
    const order = matchDishes(cat, ['rice', 'onion', 'tomato']).map((m) => m.status);
    const rank = { READY: 0, ALMOST: 1, PARTIAL: 2 } as const;
    expect([...order].sort((a, b) => rank[a] - rank[b])).toEqual(order);
  });
  it('puts dishes that use more of your ingredients first within a group', () => {
    const r = matchDishes(cat, ['tomato', 'onion', 'rice']).filter((m) => m.status === 'READY');
    const shares = r.map((m) => m.usedShare);
    expect([...shares].sort((a, b) => b - a)).toEqual(shares);
    expect(r[0].dishId).toBe('pepper-onion-sauce'); // uses two of your three
  });
  it('returns nothing for an empty pantry and respects the limit', () => {
    expect(matchDishes(cat, [])).toEqual([]);
    expect(matchDishes(cat, ['onion', 'rice', 'tomato'], { limit: 2 })).toHaveLength(2);
  });
  it('hides dishes that use none of what you have', () => {
    expect(byId(matchDishes(cat, ['egg']), 'beef-stew')).toBeUndefined();
  });
});

describe('swaps', () => {
  it('suggests a like-for-like swap from what you have, with a caveat', () => {
    const m = byId(matchDishes(cat, ['spinach', 'onion']), 'greens-stew')!;
    expect(m.missingCore[0].missing[0].id).toBe('ugu');
    expect(m.missingCore[0].swaps.map((s) => s.id)).toEqual(['spinach']);
    expect(explainMatch(m).join(' ')).toMatch(/You could use spinach instead of ugu/);
  });
  it('does not suggest a swap between unrelated foods', () => {
    const m = byId(matchDishes(cat, ['onion', 'rice']), 'beef-stew')!;
    expect(m.missingCore.every((i) => i.swaps.length === 0)).toBe(true);
  });
});

describe('filters', () => {
  const all = ['rice', 'beef', 'chicken', 'tomato', 'onion', 'ugu', 'groundnut', 'egg'];
  it('excludes dishes that contain an allergen', () => {
    expect(byId(matchDishes(cat, all, { excludeAllergens: ['peanut'] }), 'peanut-snack')).toBeUndefined();
    expect(byId(matchDishes(cat, all), 'peanut-snack')).toBeDefined();
  });
  it('keeps a dish whose allergen is only optional, but warns', () => {
    const m = byId(matchDishes(cat, all, { excludeAllergens: ['fish'] }), 'egg-dish')!;
    expect(m).toBeDefined();
    expect(m.warnings.map((w) => w.kind)).toContain('allergen_optional');
  });
  it('hides meat dishes for a no-meat filter, keeps optional-meat dishes with a note, and hides dishes with unknown contents', () => {
    const r = matchDishes(cat, all, { noMeat: true });
    expect(byId(r, 'beef-stew')).toBeUndefined();
    expect(byId(r, 'chicken-or-beef-rice')).toBeUndefined();
    expect(byId(r, 'mystery-dish')).toBeUndefined(); // unknown is treated as "contains", the safe side
    expect(byId(r, 'egg-dish')?.warnings.map((w) => w.kind)).toContain('meat_optional');
    expect(byId(r, 'greens-stew')).toBeDefined();
  });
  it('filters by cuisine but keeps dishes eaten across Nigeria', () => {
    const ids = matchDishes(cat, all, { cuisines: ['Igbo'] }).map((m) => m.dishId);
    expect(ids).toContain('greens-stew');
    expect(ids).toContain('plain-rice'); // Pan-Nigerian
    expect(ids).not.toContain('chicken-or-beef-rice'); // Yoruba
    const strict = matchDishes(cat, all, { cuisines: ['Igbo'], includePanNigerian: false }).map((m) => m.dishId);
    expect(strict).not.toContain('plain-rice');
  });
  it('filters by time, cost, and meal, letting unknown values through', () => {
    expect(byId(matchDishes(cat, all, { maxMinutes: 60 }), 'beef-stew')).toBeUndefined();
    expect(byId(matchDishes(cat, all, { maxMinutes: 60 }), 'mystery-dish')).toBeDefined();
    expect(byId(matchDishes(cat, all, { maxCost: 'MEDIUM' }), 'beef-stew')).toBeUndefined();
    const breakfast = matchDishes(cat, all, { mealSlots: ['Breakfast'] }).map((m) => m.dishId);
    expect(breakfast).toContain('egg-dish');
    expect(breakfast).toContain('plain-rice'); // "Any meal"
  });
});

describe('explanations', () => {
  it('explains a ready dish and a partial one in plain language', () => {
    const ready = explainMatch(byId(matchDishes(cat, ['beef', 'tomato', 'onion']), 'beef-stew')!);
    expect(ready.join(' ')).toMatch(/Uses your beef, tomato and onion/);
    expect(ready.join(' ')).toMatch(/all the main ingredients/);
    const partial = explainMatch(byId(matchDishes(cat, ['onion', 'rice']), 'beef-stew')!);
    expect(partial.join(' ')).toMatch(/You have 1 of 3 main ingredients. Missing: beef and tomato/);
  });
  it('does not say "and" twice when listing more than four ingredients', () => {
    const big: Catalogue = { ...cat, dishes: [dish('d', 'Big', ['rice', 'tomato', 'onion', 'beef', 'chicken', 'egg'].map((f, i) => line(i + 1, f, 'CORE', [f])))] };
    const text = explainMatch(matchDishes(big, ['rice', 'tomato', 'onion', 'beef', 'chicken', 'egg'])[0])[0];
    expect(text).toBe('Uses your rice, tomato, onion, beef and 2 more.');
  });
});
