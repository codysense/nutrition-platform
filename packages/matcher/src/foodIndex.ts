import { normalize, tokens, withinEdits } from './normalize';
import { CatalogFood } from './types';

interface IndexedName {
  foodId: string;
  display: string;
  language: string;
  norm: string;
  toks: string[];
}

export interface FoodIndex {
  foods: Map<string, CatalogFood>;
  names: IndexedName[];
}

export interface SearchResult {
  foodId: string;
  food: CatalogFood;
  matchedName: string;
  language: string;
  score: number;
}

/** "Spinach / efo tete (African spinach)" -> ["Spinach", "efo tete", "African spinach", the full string]. */
function variants(name: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t) out.add(t);
  };
  add(name);
  const bare = name.replace(/\([^)]*\)/g, ' ');
  bare.split(/[\/;]/).forEach(add);
  for (const m of name.matchAll(/\(([^)]*)\)/g)) {
    if (!m[1].includes(',')) m[1].split(/[\/;]/).forEach(add); // "(parboiled, long-grain)" is a description, not a name
  }
  return [...out];
}

export function buildFoodIndex(foods: CatalogFood[]): FoodIndex {
  const names: IndexedName[] = [];
  for (const food of foods) {
    const seen = new Set<string>();
    const push = (display: string, language: string) => {
      const norm = normalize(display);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      names.push({ foodId: food.id, display, language, norm, toks: tokens(display) });
    };
    variants(food.name).forEach((v) => push(v, 'english'));
    for (const a of food.aliases) variants(a.name).forEach((v) => push(v, a.language));
  }
  return { foods: new Map(foods.map((f) => [f.id, f])), names };
}

function scoreName(q: string, qToks: string[], n: IndexedName): number {
  if (n.norm === q) return 100;
  // Every word typed is a whole word of the name. Shorter names are more specific: "pepper" fits "red bell pepper" better than "pepper soup spice mix".
  if (qToks.every((qt) => n.toks.includes(qt))) return Math.max(72, 90 - 3 * (n.toks.length - qToks.length));
  // Still typing: every typed fragment starts a word of the name.
  if (qToks.every((qt) => n.toks.some((nt) => nt.startsWith(qt)))) return n.norm.startsWith(q) ? 75 : 70;
  if (q.length >= 3 && n.norm.includes(q)) return 50;
  // typo tolerance, only for words long enough that one slip is unlikely to hit another word
  if (q.length >= 5 && withinEdits(q, n.norm, 1)) return 40;
  if (qToks.length === 1 && q.length >= 5 && n.toks.some((nt) => nt.length >= 5 && withinEdits(q, nt, 1))) return 35;
  return 0;
}

/** Typeahead: best matching foodstuffs for what a person has typed so far, in any supported language. */
export function searchFoods(index: FoodIndex, query: string, opts: { limit?: number } = {}): SearchResult[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const qToks = tokens(query);
  const best = new Map<string, SearchResult>();
  for (const n of index.names) {
    const score = scoreName(q, qToks, n);
    if (!score) continue;
    const cur = best.get(n.foodId);
    if (!cur || score > cur.score || (score === cur.score && n.display.length < cur.matchedName.length)) {
      best.set(n.foodId, { foodId: n.foodId, food: index.foods.get(n.foodId)!, matchedName: n.display, language: n.language, score });
    }
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.matchedName.length - b.matchedName.length || a.food.name.localeCompare(b.food.name))
    .slice(0, opts.limit ?? 8);
}

export interface Resolution {
  input: string;
  status: 'matched' | 'ambiguous' | 'unknown';
  matches: SearchResult[]; // best first; for 'ambiguous' these are the tied candidates
}

/**
 * Turns one typed or pasted term into a foodstuff. An exact name is trusted. Otherwise, if several different foodstuffs
 * fit about equally well ("pepper", "beans"), it says so and lets the person choose rather than guessing.
 */
export function resolveIngredient(index: FoodIndex, input: string): Resolution {
  const results = searchFoods(index, input, { limit: 6 });
  const top = results[0];
  if (!top || top.score < 70) return { input, status: 'unknown', matches: results };
  if (top.score === 100) return { input, status: 'matched', matches: [top] };
  const close = results.filter((r) => r.score >= 70 && top.score - r.score <= 12);
  return close.length > 1 ? { input, status: 'ambiguous', matches: close } : { input, status: 'matched', matches: [top] };
}

/** "yam, eggs and tomatoes" -> resolved foods, ambiguous terms to ask about, and unknown terms (worth logging anonymously). */
export function parsePantryText(index: FoodIndex, text: string) {
  const terms = text.split(/[,;\n]|\band\b/i).map((t) => t.trim()).filter(Boolean);
  const resolved = new Map<string, CatalogFood>();
  const ambiguous: Resolution[] = [];
  const unknown: string[] = [];
  for (const term of terms) {
    const r = resolveIngredient(index, term);
    if (r.status === 'matched') resolved.set(r.matches[0].foodId, r.matches[0].food);
    else if (r.status === 'ambiguous') ambiguous.push(r);
    else unknown.push(term);
  }
  return { resolved: [...resolved.values()], ambiguous, unknown };
}
