import { describe, expect, it } from 'vitest';
import { parseAllergenFlags } from '../src';

describe('allergen flags', () => {
  it('maps flags to allergens and keeps shellfish separate from fish', () => {
    const { present } = parseAllergenFlags(['Shellfish (crustacean)', 'Fish', 'Egg', 'Wheat (gluten)', 'Milk', 'Coconut']);
    expect([...present].sort()).toEqual(['coconut', 'egg', 'fish', 'milk', 'shellfish', 'wheat']);
    expect([...parseAllergenFlags(['Shellfish (mollusc)']).present]).toEqual(['shellfish']);
  });
  it('treats peanut oil as peanut: the safe side', () => {
    expect([...parseAllergenFlags(['Peanut (oil only)']).present]).toEqual(['peanut']);
  });
  it('separates allergens that are only in optional ingredients', () => {
    const r = parseAllergenFlags(['Milk (optional)', 'Fish']);
    expect([...r.present]).toEqual(['fish']);
    expect([...r.optionalOnly]).toEqual(['milk']);
  });
  it('lets a core mention win over an optional one', () => {
    const r = parseAllergenFlags(['Egg (optional)', 'Egg']);
    expect([...r.present]).toEqual(['egg']);
    expect(r.optionalOnly.size).toBe(0);
  });
  it('ignores flags that are not a recognised allergen', () => {
    expect(parseAllergenFlags(['None identified']).present.size).toBe(0);
    expect(parseAllergenFlags(['Sesame']).present.size).toBe(0);
  });
});
