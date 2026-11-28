import { describe, expect, it } from 'vitest';
import { confirmableLines, isLineReady, readinessReport } from './readiness';
import { suggestRole } from './roles';

const f = (name: string, category = 'Other') => ({ name, category });

describe('suggestRole', () => {
  it('marks salt, sugar, oil and seasoning cubes as staples', () => {
    expect(suggestRole({ rawText: 'Salt to taste', optional: false, foods: [f('Salt')] })).toBe('STAPLE');
    expect(suggestRole({ rawText: '3 tbsp vegetable oil', optional: false, foods: [f('Vegetable oil')] })).toBe('STAPLE');
    expect(suggestRole({ rawText: '2 stock cubes, salt', optional: false, foods: [f('Stock / seasoning cubes'), f('Salt')] })).toBe('STAPLE');
  });
  it('treats unlinked water and plain oil lines as staples, and wrappers as optional', () => {
    expect(suggestRole({ rawText: 'Clean water for soaking, washing and cooking', optional: false, foods: [] })).toBe('STAPLE');
    expect(suggestRole({ rawText: 'Oil for frying', optional: false, foods: [] })).toBe('STAPLE');
    expect(suggestRole({ rawText: 'Banana leaves or small containers for steaming', optional: false, foods: [] })).toBe('OPTIONAL');
  });
  it('does not mistake coconut water or palm oil for a staple', () => {
    expect(suggestRole({ rawText: '1 cup coconut water', optional: false, foods: [] })).toBe('CORE');
    expect(suggestRole({ rawText: '1/2 cup palm oil', optional: false, foods: [f('Palm oil')] })).toBe('CORE');
  });
  it('marks spices and crayfish as seasonings, including mixed seasoning and staple lines', () => {
    expect(suggestRole({ rawText: '3 tbsp ground crayfish', optional: false, foods: [f('Crayfish (dried, ground)')] })).toBe('SEASONING');
    expect(suggestRole({ rawText: '2 stock cubes, 1 tsp curry, 1 tsp thyme, salt', optional: false, foods: [f('Stock / seasoning cubes'), f('Curry powder'), f('Thyme (dried)'), f('Salt')] })).toBe('SEASONING');
  });
  it('keeps a line core when any foodstuff on it is core', () => {
    expect(suggestRole({ rawText: '1 onion, 2 stock cubes', optional: false, foods: [f('Onion'), f('Stock / seasoning cubes')] })).toBe('CORE');
  });
  it('marks a single optional item as optional', () => {
    expect(suggestRole({ rawText: '1 tbsp butter (optional)', optional: true, foods: [f('Butter / margarine')] })).toBe('OPTIONAL');
    expect(suggestRole({ rawText: 'Evaporated milk (optional)', optional: false, foods: [] })).toBe('OPTIONAL');
  });
  it('stays strict when (optional) appears on a multi-item line, so core items are not hidden', () => {
    expect(suggestRole({ rawText: 'Utazi leaves, 1 onion, ugba (optional)', optional: true, foods: [f('Utazi leaves'), f('Onion'), f('Ugba (African oil bean)')] })).toBe('CORE');
  });
  it('treats liquid stock as a seasoning, but not a meat line that mentions stock', () => {
    expect(suggestRole({ rawText: '3 cups chicken/beef stock', optional: false, foods: [f('Chicken'), f('Beef')] })).toBe('SEASONING');
    expect(suggestRole({ rawText: '500g beef or chicken (boiled, with stock)', optional: false, foods: [f('Chicken'), f('Beef')] })).toBe('CORE');
    expect(suggestRole({ rawText: '1 stockfish piece', optional: false, foods: [f('Stockfish')] })).toBe('CORE');
  });
});

describe('readiness', () => {
  const line = (over: Partial<Parameters<typeof isLineReady>[0] & { position: number; role: string; foods: { id: string }[] }>) =>
    ({ position: 1, role: 'CORE', roleConfirmed: false, mappingStatus: 'UNMAPPED', foods: [], ...over });
  it('needs both the link and the role to be confirmed', () => {
    expect(isLineReady(line({ mappingStatus: 'CONFIRMED', roleConfirmed: true }))).toBe(true);
    expect(isLineReady(line({ mappingStatus: 'CONFIRMED', roleConfirmed: false }))).toBe(false);
    expect(isLineReady(line({ mappingStatus: 'AUTO_SUGGESTED', roleConfirmed: true }))).toBe(false);
  });
  it('reports which lines are outstanding', () => {
    const r = readinessReport([line({ position: 1, mappingStatus: 'CONFIRMED', roleConfirmed: true }), line({ position: 2 })]);
    expect(r).toEqual({ total: 2, ready: 1, notReady: [2] });
  });
  it('will not bulk-confirm a core line that has no foodstuff, but will confirm water', () => {
    const lines = [
      line({ position: 1, role: 'CORE', foods: [] }),
      line({ position: 2, role: 'STAPLE', foods: [] }),
      line({ position: 3, role: 'CORE', foods: [{ id: 'f1' }], mappingStatus: 'AUTO_SUGGESTED' }),
    ];
    expect(confirmableLines(lines).map((l) => l.position)).toEqual([2, 3]);
  });
});
