# Nigerian Nutrition Platform: back office (Phase 1)

Admin API plus the React dashboard that doubles as the **dietitian review portal**.
Stack: Node + Express + TypeScript, Prisma, PostgreSQL, Zod, JWT (API); Vite + React + TypeScript, Tailwind, TanStack Query, React Router (web).

## Run it

```bash
docker compose up -d                 # Postgres on :5432
cd api
cp .env.example .env                 # set JWT_SECRET (32+ chars); DATABASE_URL and DATABASE_URL_UNPOOLED are the same locally
npm install
npx prisma migrate dev --name init   # creates tables
npm run seed                         # loads 55 dishes, 93 foodstuffs, 11 nutrients, 5 sources
npm run dev                          # http://localhost:4000/health
npm test                             # workflow rules (vitest)
```

In a second terminal:

```bash
cd web
npm install
npm run dev                          # http://localhost:5173 (proxies /api to :4000)
```

Sign in with the seeded admin or dietitian account (see the seed output for generated passwords).

The seed prints a generated password for each seeded user if you leave the password env vars empty.
It is safe to re-run: it only creates missing rows and never overwrites edited content.

## Deploying

See **DEPLOY.md** (Neon for the database, Render for the API, Netlify for the web app).

## Roles

| Role | Can do |
|---|---|
| SUPER_ADMIN | Everything, including users |
| CONTENT_MANAGER | Edit, submit for review, publish approved content |
| NUTRITION_REVIEWER (dietitian) | Edit, comment, approve / reject / request changes, mark names verified, set evidence level |
| VIEWER | Read only |

## Review workflow

`DRAFT -> PENDING_REVIEW -> APPROVED -> PUBLISHED`, plus `REJECTED`, `REQUIRES_UPDATE`, `ARCHIVED`.
The rules live in one file, `src/modules/review/workflow.ts`, with tests.

- Only reviewers approve. Content managers publish, and nothing can skip review.
- **Four-eyes:** you cannot approve content you edited last.
- Rejecting or requesting changes requires a written note (stored in the comment thread).
- Approval is blocked while comments are unresolved.
- **Editing approved or published content sends it back to PENDING_REVIEW.**
  Toggling `namesVerified` or `evidenceLevel` does not.
- Every change writes to `AuditLog`.

## API (all under `/api/v1`, bearer token except login)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login`, GET `/auth/me` | Sign in / current user |
| GET | `/admin/nutrients` | Nutrient list for the entry form |
| GET | `/admin/stats` | Counts by status, nutrient coverage, open comments, unmapped lines |
| GET | `/admin/review/queue` | Dishes and foodstuffs waiting for review |
| PATCH | `/admin/review/comments/:id` | Resolve / reopen a comment |
| GET | `/admin/dishes`, `/admin/dishes/:id` | List (q, status, category, cuisine, page) / detail (includes `allowedTransitions` for the caller) |
| PATCH | `/admin/dishes/:id` | Edit fields |
| PUT | `/admin/dishes/:id/aliases` | Replace local names |
| PATCH | `/admin/dishes/:id/ingredients/:lineId` | Map an ingredient line to foodstuffs, quantity, unit |
| PATCH | `/admin/dishes/:id/ingredients/:lineId` | Set foodstuff links, role, confirmation for one line |
| POST | `/admin/dishes/:id/ingredients/confirm-all` | Confirm every line that can safely be confirmed |
| POST | `/admin/dishes/:id/republish` | Publish a new version of an already-published dish (after link/role changes) |
| POST | `/admin/dishes/:id/unpublish` | Take the live version offline (status unchanged) |
| GET | `/admin/dishes/:id/versions/:n` | A frozen published version |
| POST | `/admin/dishes/:id/status`, `/comments` | Workflow transition / comment on a field |
| POST | `/admin/dishes/bulk-status`, `/admin/foods/bulk-status` | Move many items at once: `{ids}` or `{filter}` (max 500), `to`, `note`. Returns moved count and skipped items with reasons. **`APPROVED` is rejected: approvals are one at a time** |
| GET | `/admin/foods`, `/admin/foods/:id` | List (also `missingNutrients=true`) / detail with used-in dishes |
| PATCH / PUT | `/admin/foods/:id`, `/:id/aliases` | Edit fields / local names |
| PUT | `/admin/foods/:id/nutrients` | Upsert values (**source and quality required**; amount `null` removes) |
| POST | `/admin/foods/:id/status`, `/comments` | Same workflow as dishes |
| GET / POST | `/admin/sources` | Knowledge sources (with license note) |
| GET / POST / PATCH | `/admin/users` | User management (SUPER_ADMIN only) |
| GET | `/admin/audit` | Audit log: filters `entityType`, `action`, paging (super admin only) |
| POST | `/auth/change-password` | Change own password; clears the temporary-password flag |
| GET | `/admin/export/dishes.json`, `dishes.csv`, `foods.csv` | Offline review exports (`status` filter); logged |

## Packages

- `api/` back-office API, `web/` back-office dashboard, `packages/matcher/` shared ingredient search and dish matching (see its README).
  The public app (`app/`, step 7.5) will import the matcher directly.

## Publishing (live versions)

A dish has a **working copy** (what staff edit and the dietitian reviews) and zero or one **live version** (a frozen snapshot the
public app reads). Publishing (`APPROVED -> PUBLISHED`) freezes the working copy as the next version number. Editing never
changes the live version. A live version is removed by `POST /admin/dishes/:id/unpublish`, by archiving the dish, or by
a reviewer moving a *Published* dish to *Needs update*. Snapshots are built in `src/modules/publishing/` (`snapshot.ts` is pure
and unit-tested; `publishing.service.ts` runs inside the status-change transaction). A content hash tells the back office when
the working copy has moved on from the live version. Foodstuffs are not snapshotted yet.

### Ingredient roles and readiness

Every `RecipeIngredientLine` has a `role` (`CORE`, `SEASONING`, `STAPLE`, `OPTIONAL`) and two confirmations: `mappingStatus = CONFIRMED` (which foodstuffs it refers to) and `roleConfirmed`. Roles are *suggested* by `src/modules/ingredients/roles.ts` (seed and `prisma/backfill-roles.ts`) and confirmed by a person. A line is **ready** when both are confirmed (`readiness.ts`); a dish can only be published when every line is ready. Core and seasoning lines must link to at least one foodstuff; staples and optional lines need none (water, foil). Link and role edits do not reopen review and do not change `lastEditedById`, so they cannot be used to bypass the four-eyes approval rule.

## Mobile and tablet

The dashboard is responsive from 360 px phones up to wide desktops.

- **Phones and small tablets (below 1024 px):** a top bar with a menu button opens a slide-out drawer (closes on navigation, Escape or tapping outside).
- **Lists (below 768 px):** tables turn into cards with "label: value" pairs, including row checkboxes for bulk actions. See `components/DataTable.tsx`; use it for any new list.
- **Detail screens:** on phones the order is status actions, content, then comments (with a "Jump to comments" link). From 1280 px the comments column sits beside the content.
- **Touch:** buttons and inputs are larger on phones, and inputs use 16 px text so iOS does not zoom in when a field is focused.

## Error format

Every API error has one shape: `{ error, code, details?, requestId }`. `error` is a message safe to show, `code` is stable
(`VALIDATION_FAILED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`, ...), and
`requestId` is also sent in the `X-Request-Id` header and written to the server log on 5xx errors. In the web app,
`src/lib/errors.ts` turns any error (including "no response" failures) into a title, message, per-field problems and hints,
and `ErrorBox` renders it, so all screens report problems the same way.

## Design decisions to review

1. **Ingredients stay as free-text lines** (`RecipeIngredientLine.rawText`) with suggested links to foodstuffs
   (`AUTO_SUGGESTED`, 298 of 342 lines at seed time). Nutrient calculation needs structured quantity and unit, so
   mapping is a dashboard task, not a one-off import.
2. **Nutrient values are rows, not columns**, and a row cannot exist without a source and quality label.
   "No row" means unavailable, so the API cannot store a guess.
3. **Claims are reviewed per field**: comments carry a `field` (e.g. `healthBenefits`, `allergenFlags`).
4. Dietitians can edit as well as comment. If you want comment-only reviewers, remove NUTRITION_REVIEWER from `EDITORS` for PATCH routes.
5. Access tokens only (8h), no refresh tokens or server-side revocation. Deactivating a user blocks them immediately; changing a password does not end their existing session.

## Not verified yet

Written without network access, so `npm install`, `prisma migrate` and a live run were **not** done.
Checked: TypeScript syntax, the workflow rules (10 cases), and the ingredient-matching logic against the dataset.
Expect to fix small type errors on the first `npm run typecheck`.

## The dashboard (web/)

| Screen | What it does |
|---|---|
| Sign in | Email + password, token kept in localStorage (see the note in `src/lib/api.ts`) |
| Overview | Status bars for dishes and foodstuffs, open comments, unmapped lines, nutrient coverage |
| Review queue | Everything pending review, oldest first, with open-comment counts and "you edited this last" |
| Dishes / Foodstuffs | Search and filter, status, open comments |
| Dish detail | Claims for review, ingredient mapping, steps, local names, details; approve / reject / request changes; comments per field |
| Bulk actions | Tick rows (or “Select all N matching” across pages) on either list, then move them together, e.g. submit all drafts for review |
| Export | CSV downloads and a printable review sheet (one dish per page, with decision and notes space) for offline review |
| Users (admin) | Create accounts with a temporary password shown once, change roles, deactivate, reset passwords |
| Audit log (admin) | Filterable history of every change, status move, export and sign-in |
| Change password | Required at first sign-in for any account with a temporary password (enforced by the API too) |
| Foodstuff detail | Details, nutrient entry (source + quality required), local names, dishes that use it |

The buttons on a detail page come from the server (`allowedTransitions`), so the UI never re-implements the workflow rules.
Reviewers see "Approve" greyed out with the reason when they were the last editor.

**Suggested walkthrough for the dietitian:** open the Review queue, pick a dish, read "Claims for review", use *Comment* on a
field that needs a change, then *Request changes* (with a note) or *Approve* once comments are resolved.
For a first review round, a content manager goes to Dishes, filters Status = Draft, ticks the header checkbox, clicks
“Select all N matching”, chooses *Submit for review* and confirms. Each item still goes through the normal rules; anything
that can't move is skipped and listed. Bulk approval is blocked on purpose so every approval is a real review.

## Not verified yet

Written without network access, so `npm install`, `prisma migrate` and a live run were **not** done on either side.
Checked: TypeScript syntax (api and web), the workflow rules, and the ingredient-matching logic against the dataset.
Expect small type errors on the first `npm run typecheck` in each folder.

## What's next

1. Refresh tokens and server-side session revocation.
2. Editing steps and ingredient quantities; then Phase 2 (food intelligence APIs on approved data).
