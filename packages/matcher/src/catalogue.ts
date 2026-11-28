import { Alias, AnimalFlesh, CatalogDish, CatalogFood, CatalogLine, Catalogue, CostTier, Role, SpiceLevel } from './types';

/** The parts of a published snapshot (see the back office's PublishedRecipe.content) that the catalogue needs. */
export interface SnapshotLike {
  slug: string;
  name: string;
  category: string;
  cuisine: string | null;
  mealSlot: string | null;
  costTier: string | null;
  spiceLevel: string | null;
  totalMinutes: number | null;
  allergenFlags: string[];
  containsAnimalFlesh: string | null;
  aliases: Alias[];
  ingredientLines: {
    position: number;
    rawText: string;
    role: string;
    foods: { id: string; name: string; category: string; aliases: Alias[] }[];
  }[];
}

// Mirrors the back office's suggested staples. Later this can be a flag set by a person on the foodstuff.
const STAPLE_NAMES = [/^salt$/i, /^sugar$/i, /^vegetable oil$/i, /^groundnut oil$/i, /^stock \/ seasoning cubes$/i];
export const isStapleFood = (name: string) => STAPLE_NAMES.some((re) => re.test(name.trim()));

const ROLES: Role[] = ['CORE', 'SEASONING', 'STAPLE', 'OPTIONAL'];

/** "beef or chicken", "potash/kaun": the foods on the line are alternatives, so having one is enough. */
export const looksLikeAlternatives = (text: string) => /\bor\b|\//i.test(text);

/** Builds the compact catalogue the app ships to the phone from the live snapshots. Pure, so it runs on the server or in a build step. */
export function buildCatalogue(version: string, items: { id: string; content: SnapshotLike }[]): Catalogue {
  const foods = new Map<string, CatalogFood>();
  const dishes: CatalogDish[] = items.map(({ id, content: c }) => {
    const lines: CatalogLine[] = c.ingredientLines.map((l) => {
      for (const f of l.foods) if (!foods.has(f.id)) foods.set(f.id, { id: f.id, name: f.name, category: f.category, aliases: f.aliases, staple: isStapleFood(f.name) });
      return {
        position: l.position,
        text: l.rawText,
        role: (ROLES as string[]).includes(l.role) ? (l.role as Role) : 'CORE',
        foodIds: l.foods.map((f) => f.id),
        anyOf: looksLikeAlternatives(l.rawText),
      };
    });
    return {
      id, slug: c.slug, name: c.name, category: c.category, cuisine: c.cuisine, mealSlot: c.mealSlot,
      costTier: c.costTier as CostTier | null, spiceLevel: c.spiceLevel as SpiceLevel | null, totalMinutes: c.totalMinutes,
      allergenFlags: c.allergenFlags, containsAnimalFlesh: c.containsAnimalFlesh as AnimalFlesh | null, aliases: c.aliases, lines,
    };
  });
  return { version, foods: [...foods.values()], dishes };
}
