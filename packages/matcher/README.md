# @nutrition/matcher

Ingredient search and dish matching for the public app. Pure TypeScript, **no dependencies**, no network or database access, so the
same code runs in the browser (the app ships the catalogue to the phone and matches on-device, offline) and on the server
(a future `/public/match` endpoint or an AI tool).

## How it fits

```
back office                 API (7.4)                        public app (7.5)
PublishedRecipe snapshots -> buildCatalogue(version, ...) -> catalogue JSON (~65 KB for 55 dishes)
                                                              buildFoodIndex(catalogue.foods)
                                                              searchFoods / parsePantryText   (typeahead, pasted lists)
                                                              matchDishes(catalogue, pantryIds, options)
                                                              explainMatch(match)
```

```ts
import { buildFoodIndex, matchDishes, parsePantryText, explainMatch } from '@nutrition/matcher';

const index = buildFoodIndex(catalogue.foods);
const { resolved, ambiguous, unknown } = parsePantryText(index, 'isu, eyin, tumatir, alubosa, ata rodo');
//   ambiguous -> ask the person ("pepper": tatashe, scotch bonnet or the spice mix?)
//   unknown   -> log anonymously: it tells you which foodstuffs to add to the catalogue next
const matches = matchDishes(catalogue, resolved.map((f) => f.id), { excludeAllergens: ['peanut'], noMeat: false });
matches.map(explainMatch);
```

## Rules (all covered by tests)

| Rule | Behaviour |
|---|---|
| Roles | `CORE` counts fully, `SEASONING` a quarter, `STAPLE` assumed (or lightly checked with `staples: 'check'`), `OPTIONAL` ignored |
| Defining ingredient | The first core line counts double, and a dish missing it is never "almost" ready |
| Status | `READY` (all core lines present), `ALMOST` (missing at most two, defining one present), otherwise `PARTIAL`; groups are listed in that order, then by how much of your pantry a dish uses |
| Alternatives | A line like "beef or chicken" is satisfied by either |
| Staple foods | Salt, cooking oil and seasoning cubes are assumed even when they sit on a mixed line |
| Swaps | Only suggested within leafy vegetables, meat, fish and tubers, always with "the taste will differ" |
| Allergens | Dishes with a core allergen are removed; optional-only allergens keep the dish with a warning; peanut oil counts as peanut |
| No meat | Dishes with unknown contents are hidden (unknown is treated as "contains") |
| Search | Local names, accents, plurals, one typo, half-typed names; an exact name is trusted, otherwise equally good matches are returned as "ambiguous" |

## Known limits

- "Alternatives" is detected from the words "or" and "/" in the ingredient line. A person can later mark lines explicitly.
- The staple-food list (`catalogue.ts`) mirrors the back office suggestions. It should become a flag on each foodstuff.
- The defining ingredient is assumed to be the first core line, which holds for the current 55 dishes.
- Explanations are English only.
- **The allergen filter reduces risk; it does not guarantee safety.** Show `LABEL_CHECK_NOTICE` wherever it is used. The flags come from
  reviewed, published dishes, but seasoning cubes and packaged ingredients can contain allergens the recipe text does not mention.

## Tests

```bash
cd packages/matcher && npm install && npm test
```

`test/catalogue.fixture.json` is generated from the real seed data, passed through the back office's own `snapshotContent()` and this
package's `buildCatalogue()`, so the two are proven to fit. Regenerate it when the seed data changes:

```bash
cd api && npm run fixture:catalogue
```

## Using it from the public app (step 7.5)

The app imports the source directly, so there is nothing to publish. In the app's `vite.config.ts` and `tsconfig.json`:

```ts
// vite.config.ts
resolve: { alias: { '@nutrition/matcher': path.resolve(__dirname, '../packages/matcher/src') } }
// tsconfig.json  ->  "paths": { "@nutrition/matcher": ["../packages/matcher/src"] }
```

Netlify clones the whole repository, so a site with base directory `app` can read `../packages/`.
