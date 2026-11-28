export type IngredientRoleName = 'CORE' | 'SEASONING' | 'STAPLE' | 'OPTIONAL';

export interface LineForRole {
  rawText: string;
  optional: boolean;
  foods: { name: string; category: string }[];
}

// Foodstuffs assumed to be in any kitchen. Editable per line in the back office; these are only first suggestions.
const STAPLE_FOODS = [/^salt$/i, /^sugar$/i, /^vegetable oil$/i, /^groundnut oil$/i, /^stock \/ seasoning cubes$/i];

// Flavourings: a dish is still a good match without them.
const SEASONING_FOODS = [
  /^ginger$/i, /^cloves$/i, /^garlic$/i, /^nutmeg$/i, /^curry powder$/i, /^thyme/i, /^bay leaves$/i, /^pepper soup spice/i, /^yaji/i,
  /^edible potash/i, /^ehuru/i, /^uziza/i, /^scent leaf/i, /^crayfish/i, /^iru \/ daddawa/i, /^ogiri/i,
];

const matches = (list: RegExp[], name: string) => list.some((re) => re.test(name.trim()));

const WRAPPING = /\b(foil|wrap|wraps|wrapper|wrappers|mould|moulds|container|containers|food-grade|banana leaves)\b/i;

/**
 * First-guess role for an ingredient line. It is a suggestion: a person must confirm it (roleConfirmed)
 * before the dish can be published, and the public app only trusts confirmed lines.
 */
// "Chicken stock", "3 cups warm beef stock": a flavour liquid, not a foodstuff you must have (seasoning cubes and water cover it).
const STOCK_LIQUID = /^\s*(?:about\s+)?[\d\s/.\-]*\s*(?:cups?|litres?|liters?|ml|l)?\s*(?:of\s+)?(?:(?:warm|hot|clean|chicken|beef|goat|meat|vegetable|fish|or|and)\b|[/\s])*stock\b/i;

// More than one item on the line, e.g. "2 stock cubes, 1 tbsp iru (optional)".
const MULTI_ITEM = /,|\+|\band\b/i;

export function suggestRole(line: LineForRole): IngredientRoleName {
  const markedOptional = line.optional || /\(optional\)/i.test(line.rawText);
  // "(optional)" on a multi-item line usually belongs to just one of the items. Staying strict (not OPTIONAL) is the safe
  // default: marking the whole line optional could hide a core ingredient from matching. A reviewer splits or confirms it.
  if (markedOptional && !MULTI_ITEM.test(line.rawText)) return 'OPTIONAL';
  if (STOCK_LIQUID.test(line.rawText) && !/cube/i.test(line.rawText)) return 'SEASONING';

  if (line.foods.length === 0) {
    if (WRAPPING.test(line.rawText)) return 'OPTIONAL';
    // Water and plain cooking oil have no foodstuff record: they are staples, not missing ingredients.
    if (/\bwater\b/i.test(line.rawText) && !/(coconut|tiger|palm)/i.test(line.rawText)) return 'STAPLE';
    if (/\boil\b/i.test(line.rawText) && !/palm oil/i.test(line.rawText)) return 'STAPLE';
    return 'CORE';
  }

  const names = line.foods.map((f) => f.name);
  if (names.every((n) => matches(STAPLE_FOODS, n))) return 'STAPLE';
  if (names.every((n) => matches(STAPLE_FOODS, n) || matches(SEASONING_FOODS, n))) return 'SEASONING';
  return 'CORE';
}
