import { describe, expect, it } from 'vitest';
import { buildFoodIndex, Catalogue, parsePantryText, resolveIngredient, searchDishes, searchFoods } from '../src';
import fixture from './catalogue.fixture.json';

// Realistic data: the seeded catalogue (55 dishes, 92 foodstuffs with Yoruba, Hausa and Igbo names).
const catalogue = fixture as unknown as Catalogue;
const index = buildFoodIndex(catalogue.foods);
const top = (q: string) => searchFoods(index, q, { limit: 3 })[0]?.food.name ?? '';

describe('ingredient search', () => {
  it('finds foodstuffs by English, Yoruba, Hausa and Igbo names', () => {
    expect(top('ugwu')).toMatch(/^Ugu/);
    expect(top('tumatir')).toMatch(/^Tomato/);
    expect(top('alubosa')).toMatch(/^Onion/);
    expect(top('isu')).toMatch(/^Yam/);
    expect(top('ewuro')).toMatch(/^Bitterleaf/);
    expect(top('kubewa')).toMatch(/^Okra/);
    expect(top('ila')).toMatch(/^Okra/);
    expect(top('fluted pumpkin')).toMatch(/^Ugu/);
  });
  it('ignores accents and capitals', () => {
    expect(top('Ìsú')).toMatch(/^Yam/);
    expect(top('ALUBOSA')).toMatch(/^Onion/);
  });
  it('forgives plurals and one typo', () => {
    expect(top('tomatoes')).toMatch(/^Tomato/);
    expect(top('onions')).toMatch(/^Onion/);
    expect(top('tomatoe')).toMatch(/^Tomato/);
    expect(top('crayfsh')).toMatch(/^Crayfish/);
  });
  it('completes a half-typed name', () => {
    expect(top('cray')).toMatch(/^Crayfish/);
    expect(top('bitter')).toMatch(/^Bitterleaf/);
  });
  it('needs at least two characters', () => {
    expect(searchFoods(index, 'a')).toEqual([]);
    expect(searchFoods(index, '')).toEqual([]);
  });
  it('finds every local name of every foodstuff within the top three results', () => {
    const misses: string[] = [];
    for (const f of catalogue.foods)
      for (const a of f.aliases)
        for (const part of a.name.split(/[\/;]/).map((s) => s.trim()).filter(Boolean)) {
          const ids = searchFoods(index, part, { limit: 3 }).map((r) => r.foodId);
          if (!ids.includes(f.id)) misses.push(`${a.language}: ${part}`);
        }
    expect(misses).toEqual([]);
  });
});

describe('resolving typed ingredients', () => {
  it('trusts an exact name', () => {
    const r = resolveIngredient(index, 'yam');
    expect(r.status).toBe('matched');
    expect(r.matches[0].food.name).toBe('Yam (white yam)');
  });
  it('asks when several foodstuffs fit equally well, instead of guessing', () => {
    const pepper = resolveIngredient(index, 'pepper');
    expect(pepper.status).toBe('ambiguous');
    const names = pepper.matches.map((m) => m.food.name).join(' | ');
    expect(names).toMatch(/Tatashe/);
    expect(names).toMatch(/Scotch bonnet/);
    const beans = resolveIngredient(index, 'beans');
    expect(beans.status).toBe('ambiguous');
    expect(beans.matches.map((m) => m.food.name).join(' | ')).toMatch(/Black-eyed/);
  });
  it('reports what it does not know, so missing foods can be learned from', () => {
    expect(resolveIngredient(index, 'dragonfruit').status).toBe('unknown');
  });
  it('splits a pasted list on commas, semicolons, new lines and "and"', () => {
    const p = parsePantryText(index, 'yam, eggs and tomatoes; onions\nplantain, dragonfruit, pepper');
    expect(p.resolved.map((f) => f.name.split(' ')[0]).sort()).toEqual(['Egg', 'Onion', 'Plantain', 'Tomato', 'Yam']);
    expect(p.unknown).toEqual(['dragonfruit']);
    expect(p.ambiguous).toHaveLength(1);
    expect(p.ambiguous[0].input).toBe('pepper');
  });
});

describe('dish search', () => {
  it('finds dishes by name, local name, typo and half-typed name', () => {
    expect(searchDishes(catalogue, 'amala')[0].name).toMatch(/^Amala/);
    expect(searchDishes(catalogue, 'moin')[0].name).toBe('Moi Moi');
    expect(searchDishes(catalogue, 'ofe oha')[0].name).toMatch(/^Ofe Oha/);
    expect(searchDishes(catalogue, 'jolof')[0].name).toBe('Jollof Rice');
    expect(searchDishes(catalogue, 'x')).toEqual([]);
  });
});
