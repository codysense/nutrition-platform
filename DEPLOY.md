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
