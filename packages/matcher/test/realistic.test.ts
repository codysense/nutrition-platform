import { describe, expect, it } from 'vitest';
import { buildFoodIndex, Catalogue, matchDishes, parsePantryText } from '../src';
import fixture from './catalogue.fixture.json';

// The scenarios from the product brief, run against the real seeded catalogue.
const catalogue = fixture as unknown as Catalogue;
const index = buildFoodIndex(catalogue.foods);
const nameOf = (id: string) => catalogue.dishes.find((d) => d.id === id)!.name;
const run = (text: string, opts = {}) => {
  const p = parsePantryText(index, text);
  return matchDishes(catalogue, p.resolved.map((f) => f.id), opts).map((m) => ({ ...m, name: nameOf(m.dishId) }));
};

describe('on the real catalogue', () => {
  it('suggests yam and egg sauce for "yam, eggs, tomatoes, onions, scotch bonnet"', () => {
    const r = run('yam, eggs, tomatoes, onions, ata rodo');
    expect(r[0].name).toBe('Yam & Egg Sauce');
    expect(r[0].status).toBe('READY');
    expect(r[0].usedShare).toBe(1);
  });
  it('gives the same answer using Yoruba and Hausa names', () => {
    const r = run('isu, eyin, tumatir, alubosa, ata rodo');
    expect(r[0].name).toBe('Yam & Egg Sauce');
  });
  it('offers fried plantain first for "plantain"', () => {
    expect(run('plantain')[0].name).toBe('Fried Plantain (Dodo)');
  });
  it('never calls a beans dish almost-ready when there are no beans', () => {
    const r = run('ugwu, stockfish, palm oil, crayfish, onion');
    const agoyin = r.find((m) => m.name.startsWith('Ewa Agoyin'));
    expect(agoyin === undefined || agoyin.status === 'PARTIAL').toBe(true);
  });
  it('removes peanut dishes for a peanut allergy', () => {
    const names = run('groundnuts, garri, milk, sugar', { excludeAllergens: ['peanut'] }).map((m) => m.name);
    expect(names).not.toContain('Kuli-kuli');
    expect(names).not.toContain('Garri Soakings'); // groundnuts are in the recipe as written
  });
  it('removes every meat and fish dish for a no-meat filter', () => {
    const r = run('rice, tomatoes, onions, beans, plantain', { noMeat: true });
    for (const m of r) {
      const d = catalogue.dishes.find((x) => x.id === m.dishId)!;
      expect(d.containsAnimalFlesh === 'NO' || d.containsAnimalFlesh === 'OPTIONAL').toBe(true);
    }
  });
  it('stays fast on ten times as many dishes', () => {
    const big: Catalogue = { ...catalogue, dishes: Array.from({ length: 10 }, (_, k) => catalogue.dishes.map((d) => ({ ...d, id: `${d.id}_${k}` }))).flat() };
    const ids = parsePantryText(index, 'yam, eggs, tomatoes, onions, ata rodo, rice, beans, plantain').resolved.map((f) => f.id);
    const t0 = Date.now();
    for (let i = 0; i < 10; i++) matchDishes(big, ids);
    expect((Date.now() - t0) / 10 < 250).toBe(true); // 550 dishes; far below 250 ms per query even on a slow phone-class machine
  });
});
