export const ALLERGENS = [
  { key: 'peanut', label: 'Peanut (groundnut)' },
  { key: 'egg', label: 'Egg' },
  { key: 'milk', label: 'Milk' },
  { key: 'fish', label: 'Fish' },
  { key: 'shellfish', label: 'Shellfish (crayfish, prawns, periwinkle)' },
  { key: 'wheat', label: 'Wheat (gluten)' },
  { key: 'coconut', label: 'Coconut' },
] as const;

export type AllergenKey = (typeof ALLERGENS)[number]['key'];

export const allergenLabel = (k: AllergenKey) => ALLERGENS.find((a) => a.key === k)!.label;

/** Shown wherever allergens are filtered. A filter reduces risk; it cannot guarantee a dish is safe. */
export const LABEL_CHECK_NOTICE =
  'Always check the labels of seasoning cubes and packaged ingredients, which can contain allergens. This filter is a guide, not a guarantee.';

function keyOf(flag: string): AllergenKey | null {
  const f = flag.toLowerCase();
  if (f.includes('shellfish')) return 'shellfish'; // before "fish"
  if (f.includes('fish')) return 'fish';
  if (f.includes('peanut') || f.includes('groundnut')) return 'peanut'; // "oil only" is still treated as peanut: the safe side
  if (f.includes('egg')) return 'egg';
  if (f.includes('milk')) return 'milk';
  if (f.includes('wheat') || f.includes('gluten')) return 'wheat';
  if (f.includes('coconut')) return 'coconut';
  return null; // e.g. "Check label (may contain ...)" is a notice, not an allergen
}

/**
 * `present`: the dish contains it in a core part of the recipe. `optionalOnly`: it appears only in an
 * optional ingredient, so the dish can be made without it.
 */
export function parseAllergenFlags(flags: string[]): { present: Set<AllergenKey>; optionalOnly: Set<AllergenKey> } {
  const present = new Set<AllergenKey>();
  const optional = new Set<AllergenKey>();
  for (const flag of flags) {
    const k = keyOf(flag);
    if (!k) continue;
    (/\(optional\)/i.test(flag) ? optional : present).add(k);
  }
  const optionalOnly = new Set([...optional].filter((k) => !present.has(k)));
  return { present, optionalOnly };
}
