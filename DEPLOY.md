# Deploying to staging: Neon (database), Render (API) and Netlify (web)

About 45 minutes the first time. Do the steps in order.

## 0. One-time local prep

The schema gained a field (`mustChangePassword`), so create its migration and **commit the whole `api/prisma/migrations` folder**.
`prisma migrate deploy` applies committed migrations; it cannot create them.

```bash
cd api
# your local .env needs DATABASE_URL_UNPOOLED too (see .env.example; same value as DATABASE_URL for local Docker)
npx prisma migrate dev --name add_must_change_password
cd ..
git init   # if this is not a repository yet
git add . && git commit -m "Staging-ready back office"
```

Push the repository to GitHub (the `.gitignore` already keeps `.env` and `node_modules` out).

## 1. Neon: database (free plan)

1. Neon console -> **New project** -> name it `nutrition-staging`. Keep it separate from your two live projects. Choose a region near Render's Frankfurt (AWS Frankfurt if offered).
2. Open the project -> **Connect**. You need **two** strings, and the dropdown has a "Connection pooling" switch:
   - **Pooled** (host contains `-pooler`) -> this becomes `DATABASE_URL`. Append `&connect_timeout=15` to it.
   - **Direct / unpooled** (no `-pooler`) -> this becomes `DATABASE_URL_UNPOOLED`.

Why two: the app benefits from Neon's pooler, but Prisma migrations need a direct connection. The schema already points at both
(`url` and `directUrl`).

Things to expect on the free plan: the database goes to sleep after about 5 minutes without queries, so the first request after a
quiet period takes a few extra seconds (that is what `connect_timeout=15` is for). Backups are limited to a short restore
window, so keep the weekly CSV exports described at the end.

## 2. Load the dataset (from your machine)

Use the **direct** string for this one-off step:

```bash
cd api
DATABASE_URL="<direct string>" DATABASE_URL_UNPOOLED="<direct string>" npx prisma migrate deploy
DATABASE_URL="<direct string>" DATABASE_URL_UNPOOLED="<direct string>" \
SEED_ADMIN_EMAIL="you@yourdomain.com" SEED_ADMIN_PASSWORD="a-long-temporary-password" \
SEED_REVIEWER_EMAIL="dietitian@example.com" SEED_REVIEWER_PASSWORD="another-temporary-password" \
npm run seed
```

You should see: `Seed complete: 93 foodstuffs, 55 dishes, 342 ingredient lines (298 auto-suggested ...)`.
Both seeded accounts are forced to change their password at first sign-in. If the connection fails with a channel-binding
or SSL message, remove `&channel_binding=require` from the string and keep `sslmode=require`.

## 3. Render: API

1. Render dashboard -> **New -> Blueprint** -> pick the repository. Render reads `render.yaml` at the repo root. It creates the API service only.
2. When prompted, enter: `DATABASE_URL` (pooled string), `DATABASE_URL_UNPOOLED` (direct string) and, for `CORS_ORIGIN`, a placeholder such as `https://placeholder.netlify.app` (you will fix it in step 5).
3. Wait for `nutrition-api` to show **Live**. Open `https://<your-api>.onrender.com/health`: it should return `{"ok":true}`.

The free web service sleeps after 15 minutes without traffic, so the first request takes a few seconds (a little longer if
Neon was asleep too). Switch `plan: free` to `plan: starter` in `render.yaml` if that bothers the dietitian. Open the site
yourself a minute before her session.

## 4. Netlify: web app

1. Netlify -> **Add new site -> Import from Git** -> the same repository.
2. **Base directory:** `web`. Build command and publish directory come from `web/netlify.toml`.
3. **Environment variable:** `VITE_API_URL` = `https://<your-api>.onrender.com/api/v1`
4. Deploy. Note the site URL.

## 5. Tell the API about the web app

Render -> `nutrition-api` -> **Environment** -> set `CORS_ORIGIN` to your Netlify **origin**: the scheme and host only.

| Right | Wrong |
|---|---|
| `https://your-site.netlify.app` | `https://your-site.netlify.app/login` (has a path) |
| | `https://your-site.netlify.app/` (trailing slash) |
| | `your-site.netlify.app` (no `https://`) |

The browser sends only the origin, so anything extra never matches. The API now trims a path or trailing slash for you and
prints a warning in the Render logs, but set it correctly anyway. For more than one site (for example a Netlify preview),
separate origins with commas. Save: Render redeploys.

## Troubleshooting: the web app cannot reach the API

The login page shows **"Can't reach the server"** when the browser gets no usable response. Check in this order:

1. **Is the API up?** Open `https://<your-api>.onrender.com/health`. It must return `{"ok":true}`. The first request after
   15 idle minutes can take up to a minute on the free plan.
2. **Does the Netlify build know the API address?** `VITE_API_URL` is baked in at build time, so after adding or changing it you must
   **Deploy -> Trigger deploy -> Clear cache and deploy site**. It must end in `/api/v1` and have no trailing slash.
3. **Is the origin allowed?** Render -> Logs. At start-up you will see `[config] CORS allowed origins: ...`. If someone was
   blocked you will see `[cors] Blocked a request from "https://..."`. The origin in that line is exactly what `CORS_ORIGIN` must contain.
4. **Test CORS directly** (replace the two URLs). A correct setup prints an `access-control-allow-origin` line:

```bash
curl -i -X OPTIONS "https://<your-api>.onrender.com/api/v1/auth/login" \
  -H "Origin: https://<your-site>.netlify.app" \
  -H "Access-Control-Request-Method: POST"
```

5. **Browser DevTools -> Network**: click the failed `login` request. A red "CORS error" means step 3; a request to the wrong host
   (for example your Netlify domain) means step 2.

Every error shown in the app has a **Technical details** section with the status, a code and a reference id. The same reference
id appears in the Render logs, so a screenshot is enough to find the matching server log line.

## 6. Smoke test (10 minutes)

1. Open the Netlify URL and sign in as the admin. You are sent to **Change password**; set a real one.
2. **Overview** loads with 55 dishes and 93 foodstuffs.
3. **Users** -> create the dietitian account (this replaces the placeholder reviewer). Copy the temporary password. Deactivate the placeholder.
4. **Dishes** -> Status Draft -> select all matching -> **Submit for review**.
5. Sign in as the dietitian in a private window: change password, open **Review queue**, open one dish, comment on a field, request changes.
6. As admin, resolve the comment, resubmit, then approve as the dietitian.
7. **Export** -> open the review sheet -> Print -> Save as PDF.
8. **Audit log** shows every step above.

## 7. Ongoing

- **Back up the work.** Each week, download the dishes and foodstuffs CSVs from **Export** and keep them somewhere safe. Also check Neon's restore options on your plan.
- **Never commit `.env`.** Secrets live in Render and Netlify settings. `JWT_SECRET` is generated by Render.
- **Deploying changes:** push to the main branch; both services redeploy. New database changes need a new migration committed first (`npx prisma migrate dev --name what_changed`).
- **Giving the dietitian access:** only through the Users screen. Deactivate accounts when someone leaves; deactivation takes effect immediately.

---

# Updating a running system: publishing snapshots and ingredient roles (steps 7.1 and 7.2, one deploy)

Use this when your dietitian is already reviewing in the back office. Both changes are in **one migration** and one deploy.
The migration only **adds** things (a table, a column on dishes, two columns on ingredient lines, a type), so nothing she has
reviewed, approved or commented on is altered, and the old API code keeps working while the new one starts.

What she will notice: a "Public visibility" panel on each dish, a "Public" column in the dish list, "Publish" now reading
"Publish (go live)", and role selectors on the ingredient lines (which are an admin job, not hers). Nothing becomes public to
visitors yet, because the public app does not exist.

## What changes in how things work

- **Publish creates a frozen live version** (v1, v2, ...). The public app will read only these.
- **Editing a live dish does not change what visitors see.** A claim edit goes back to review as usual; the live version stays
  until the new one is approved and published. The panel shows an amber notice while the two differ.
- **Taking content offline:** the **Take offline** button, archiving the dish, or a reviewer choosing *Request changes* on a
  *Published* dish all remove the live version immediately.
- **Ingredient roles:** every ingredient line is Core, Seasoning, Staple (water, salt, oil, cooking cubes) or Optional. The public
  app uses this so "salt and water" never count as missing ingredients. The migration sets a *suggested* role on every line.
- **A dish cannot go live until every ingredient line is confirmed** (its foodstuff links and its role). Expect "Publish (go live)"
  to be refused, with a clear message, until that is done. Bulk publishing lists the dishes it skipped and why.
- **Ingredient edits are not review edits.** Confirming links or roles does not send an approved dish back to review and does not change
  "last edited by". If a *Published* dish's links or roles change, use **Publish update (go live)** in its Public visibility panel.
- Old versions are kept. Version numbers are never reused.

## A. Before you touch anything (10 minutes)

1. **Tell the reviewers** you will restart the system and pick a quiet time. The API is unavailable for roughly one to two minutes
   during the deploy. Ask them to save or submit what they are typing first.
2. **Back up the data.** Sign in as admin -> **Export** -> download the **dishes CSV** (status: All) and the **foodstuffs CSV**.
3. **Create a restore point in Neon** if your plan allows it: Neon console -> your `nutrition-staging` project -> **Branches** ->
   create a branch from the main branch named `before-publishing-and-roles`. Delete it after a few days.

## B. On your machine

```bash
git pull   # or unzip the new version over your working copy
cd api
npm install
npx prisma migrate dev --name add_publishing_and_ingredient_roles   # uses your LOCAL database; creates the migration files
```

If you already ran `migrate dev` for step 7.1 alone, delete that migration folder first (only if it has **not** been deployed), or
tell me and I will give you a small second migration instead.

Check that the migration only adds things. This should print **nothing**:

```bash
grep -iE "drop|delete|truncate" prisma/migrations/*add_publishing_and_ingredient_roles*/migration.sql
```

If it prints anything, stop and send it to me before going further. Then:

```bash
npm run typecheck && npm test            # in api/
cd ../web && npm install && npm run typecheck
cd .. && git add -A && git commit -m "Publishing snapshots and ingredient roles (7.1, 7.2)"
```

## C. Deploy

1. `git push`. Render and Netlify deploy automatically. The API goes first; the web app is written to cope with either order.
2. Render -> `nutrition-api` -> **Logs**. Look for these lines, in this order:
   - `Applying migration ... add_publishing_and_ingredient_roles` (the database change)
   - `[backfill-roles] checked 342 unconfirmed line(s), updated ...` (suggested roles; the number you see depends on how many lines differ from the default)
   - `[backfill] 0 snapshot(s) created` (or a number, if some dishes were already marked Published)
   - `API listening on :...`
3. Open `https://<your-api>.onrender.com/health`: `{"ok":true}`.

## D. Check it works (10 minutes, as admin)

1. **Overview** shows new tiles: *Dishes live to the public*, *Ingredient lines to confirm* and *Ingredient lines confirmed* (near 0% at first).
2. **Dishes** has a **Public** column, a **Lines to confirm** column and a "Live and not live" filter.
3. Open a dish. **Ingredients** now shows a **Role** selector on each line, with "role suggested" on every line.
   Lines such as "water" show *Staple*, spices and crayfish show *Seasoning*, and "(optional)" items show *Optional*.
4. Click **Confirm all that are ready to confirm**. The progress bar in **Public visibility** moves up. Lines that still need a
   foodstuff are listed as outstanding. Fix those by hand (add a foodstuff, or change the role to Staple/Optional if none applies).
5. Once the bar is at 100% and the dish is **Approved**, click **Publish (go live)**. The panel says **Live · v1**.
   Before 100% the same click must be refused with "N of M ingredient lines still need confirming".
6. Change one line's role: the panel shows the amber "working copy has changes that are not live yet" notice, and a
   **Publish update (go live)** button appears. Click it: **Live · v2**. Check **Version history** lists v1 and v2.
7. Click **Take offline** and confirm. It returns to *Not live*. **Audit log** shows the Publish and Unpublish events.

Steps 5 to 7 affect nothing visitors can see. If you would rather not touch a reviewed dish, test on any approved dish and take it offline afterwards.

## The new workload: confirming ingredient lines

There are 342 lines across 55 dishes, about six per dish. "Confirm all" per dish does most of it in one click, but **read the
amber "Several items on this line" hints first**: about 43 lines mix several items (for example "Pepper, 2 stock cubes, salt"),
and a wrong suggestion there can hide a real ingredient from matching. This is an admin job and does not need the dietitian.
You can do it dish by dish after the deploy; dishes you have not finished simply stay unpublishable.

## E. If something goes wrong

- **API will not start:** Render -> **Deploys** -> choose the previous successful deploy -> **Rollback**. The new table, column and
  type stay in the database, unused and harmless, because the old code ignores them.
- **Data looks wrong:** do not run `prisma migrate reset` (it erases everything). Restore from the Neon branch you created in A3, or
  re-import from the CSVs, and send me the Render log lines.
- **Web app shows errors but the API is fine:** Netlify -> **Deploys** -> re-run the latest deploy with **Clear cache and deploy site**.
