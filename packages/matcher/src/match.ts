import { AllergenKey, allergenLabel, parseAllergenFlags } from './allergens';
import { CatalogDish, CatalogFood, CatalogLine, Catalogue, CostTier, SpiceLevel } from './types';

export interface MatchOptions {
  /** Foodstuffs the person has. Staples (water, salt, cooking oil, seasoning cubes) are assumed unless staples is 'check'. */
  staples?: 'assume' | 'check';
  excludeAllergens?: AllergenKey[];
  /** Hide dishes that contain meat, fish or shellfish. Dishes where it is only an optional item are kept with a note. */
  noMeat?: boolean;
  cuisines?: string[];
  /** When filtering by cuisine, also keep dishes eaten across Nigeria. Default true. */
  includePanNigerian?: boolean;
  mealSlots?: string[];
  maxCost?: CostTier;
  maxMinutes?: number;
  maxSpice?: SpiceLevel;
  /** A dish must use at least this many of the person's foodstuffs. Default 1. */
  minUsed?: number;
  limit?: number;
}

export type MatchStatus = 'READY' | 'ALMOST' | 'PARTIAL';

export interface MissingItem {
  text: string;
  role: 'CORE' | 'SEASONING' | 'STAPLE';
  /** Foodstuffs on this line that the person does not have. */
  missing: { id: string; name: string }[];
  /** Foodstuffs the person does have that could stand in, with a caveat. Only offered for like-for-like categories. */
  swaps: { id: string; name: string; reason: string }[];
}

export interface DishWarning {
  kind: 'allergen_optional' | 'meat_optional';
  message: string;
}

export interface DishMatch {
  dishId: string;
  status: MatchStatus;
  matchPercent: number; // 0..100, weighted: core ingredients count fully, seasonings a quarter
  coreTotal: number;
  coreHave: number; // core lines the person fully has
  missingCore: MissingItem[];
  missingSeasoning: MissingItem[];
  usedFoods: { id: string; name: string }[];
  usedShare: number; // share of the person's foodstuffs this dish uses (0..1)
  assumedStaples: string[]; // lines assumed to be available, e.g. "5 cups water"
  warnings: DishWarning[];
}

const COST: Record<CostTier, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const SPICE: Record<SpiceLevel, number> = { MILD: 1, MEDIUM: 2, HOT: 3 };
const STATUS_ORDER: Record<MatchStatus, number> = { READY: 0, ALMOST: 1, PARTIAL: 2 };
const WEIGHT = { CORE: 1, SEASONING: 0.25, STAPLE: 0.15, OPTIONAL: 0 } as const;
// The first core line of a recipe is its defining ingredient (the rice in jollof, the beans in moi moi). It counts double,
// and a dish missing it is never "almost" ready.
const ANCHOR_WEIGHT = 2;

// Swaps are only suggested within categories where a substitution is usually reasonable.
const SWAPPABLE = new Set(['Leafy vegetables', 'Meat & poultry', 'Fish & seafood', 'Tubers & roots']);

const rounded = (n: number) => Math.round(n * 100);

function availability(line: CatalogLine, has: (id: string) => boolean): number {
  if (line.foodIds.length === 0) return 0;
  const have = line.foodIds.filter(has).length;
  return line.anyOf ? (have > 0 ? 1 : 0) : have / line.foodIds.length;
}

function passesFilters(d: CatalogDish, o: MatchOptions): boolean {
  if (o.noMeat && d.containsAnimalFlesh !== 'NO' && d.containsAnimalFlesh !== 'OPTIONAL') return false; // unknown is treated as "contains"
  if (o.cuisines?.length) {
    const ok = d.cuisine !== null && (o.cuisines.includes(d.cuisine) || (o.includePanNigerian !== false && d.cuisine === 'Pan-Nigerian'));
    if (!ok) return false;
  }
  if (o.mealSlots?.length && d.mealSlot !== null && d.mealSlot !== 'Any meal' && !o.mealSlots.includes(d.mealSlot)) return false;
  if (o.maxCost && d.costTier && COST[d.costTier] > COST[o.maxCost]) return false;
  if (o.maxSpice && d.spiceLevel && SPICE[d.spiceLevel] > SPICE[o.maxSpice]) return false;
  if (o.maxMinutes !== undefined && d.totalMinutes !== null && d.totalMinutes > o.maxMinutes) return false;
  return true;
}

/**
 * Ranks published dishes against what a person has.
 *
 * Roles decide what counts: CORE lines must be present for a full match, SEASONING lines count for a quarter,
 * STAPLE lines (water, salt, cooking oil) are assumed unless staples:'check', and OPTIONAL lines are ignored.
 * Ordering: dishes you can cook now, then those missing one or two core items, then partial matches; within each, dishes
 * that use more of what you have come first.
 */
export function matchDishes(catalogue: Catalogue, pantryIds: Iterable<string>, options: MatchOptions = {}): DishMatch[] {
  const pantry = new Set(pantryIds);
  if (pantry.size === 0) return [];
  const foods = new Map<string, CatalogFood>(catalogue.foods.map((f) => [f.id, f]));
  const staples = options.staples ?? 'assume';
  const minUsed = options.minUsed ?? 1;
  const pantryFoods = [...pantry].map((id) => foods.get(id)).filter((f): f is CatalogFood => !!f);
  // Staple foodstuffs (salt, cooking oil, seasoning cubes) are assumed to be there unless the person asks us to check.
  const has = (id: string) => pantry.has(id) || (staples === 'assume' && foods.get(id)?.staple === true);
  const out: DishMatch[] = [];

  for (const dish of catalogue.dishes) {
    const allergens = parseAllergenFlags(dish.allergenFlags);
    if (options.excludeAllergens?.some((k) => allergens.present.has(k))) continue;
    if (!passesFilters(dish, options)) continue;

    const dishFoodIds = new Set(dish.lines.flatMap((l) => l.foodIds));
    let weightTotal = 0, weightHave = 0, coreTotal = 0, coreHave = 0, coreFraction = 0;
    const missingCore: MissingItem[] = [];
    const missingSeasoning: MissingItem[] = [];
    const assumedStaples: string[] = [];
    const used = new Map<string, string>();
    const anchor = [...dish.lines].sort((a, b) => a.position - b.position).find((l) => l.role === 'CORE');
    let anchorMissing = false;

    for (const line of dish.lines) {
      if (line.role === 'OPTIONAL') continue;
      if (line.role === 'STAPLE' && staples === 'assume') {
        assumedStaples.push(line.text);
        continue;
      }
      const have = availability(line, has);
      const isAnchor = line === anchor;
      const w = isAnchor ? ANCHOR_WEIGHT : WEIGHT[line.role];
      weightTotal += w;
      weightHave += w * have;
      for (const id of line.foodIds) if (pantry.has(id)) used.set(id, foods.get(id)?.name ?? id);
      if (isAnchor && have < 1) anchorMissing = true;
      if (line.role === 'CORE') {
        coreTotal++;
        coreFraction += have;
        if (have === 1) coreHave++;
      }
      if (have < 1) {
        const absent = line.foodIds.filter((id) => !has(id)).map((id) => ({ id, name: foods.get(id)?.name ?? id }));
        const swaps: MissingItem['swaps'] = [];
        for (const m of absent) {
          const cat = foods.get(m.id)?.category;
          if (!cat || !SWAPPABLE.has(cat)) continue;
          for (const p of pantryFoods) {
            if (p.category === cat && !dishFoodIds.has(p.id) && swaps.length < 2 && !swaps.some((s) => s.id === p.id))
              swaps.push({ id: p.id, name: p.name, reason: `${cat.toLowerCase()}: the taste will differ` });
          }
        }
        (line.role === 'CORE' ? missingCore : missingSeasoning).push({ text: line.text, role: line.role as 'CORE' | 'SEASONING' | 'STAPLE', missing: absent, swaps });
      }
    }

    if (used.size < minUsed) continue;

    const missingCoreCount = missingCore.length;
    const status: MatchStatus =
      missingCoreCount === 0 ? 'READY' : !anchorMissing && missingCoreCount <= 2 && coreTotal > 0 && coreFraction / coreTotal >= 0.5 ? 'ALMOST' : 'PARTIAL';

    const warnings: DishWarning[] = [];
    for (const k of allergens.optionalOnly)
      if (options.excludeAllergens?.includes(k)) warnings.push({ kind: 'allergen_optional', message: `Contains ${allergenLabel(k)} only in an optional ingredient: leave it out.` });
    if (options.noMeat && dish.containsAnimalFlesh === 'OPTIONAL')
      warnings.push({ kind: 'meat_optional', message: 'Includes meat or fish only as an optional ingredient: leave it out.' });

    out.push({
      dishId: dish.id,
      status,
      matchPercent: weightTotal > 0 ? rounded(weightHave / weightTotal) : 100,
      coreTotal, coreHave, missingCore, missingSeasoning,
      usedFoods: [...used].map(([id, name]) => ({ id, name })),
      usedShare: used.size / pantry.size,
      assumedStaples, warnings,
    });
  }

  const dishes = new Map(catalogue.dishes.map((d) => [d.id, d]));
  out.sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    b.usedShare - a.usedShare ||
    b.matchPercent - a.matchPercent ||
    a.missingCore.length - b.missingCore.length ||
    dishes.get(a.dishId)!.name.localeCompare(dishes.get(b.dishId)!.name),
  );
  return out.slice(0, options.limit ?? 50);
}
