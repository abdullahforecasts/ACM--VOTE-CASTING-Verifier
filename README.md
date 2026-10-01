# VoteCheck

Lightweight roll-number vote checker. Type a roll number (e.g. `BSCS24009`, `BSEDS25009`, `MSCS24009`):

- **new** → saved with the current date & time
- **already there** → red warning showing *when* it was entered

Anyone can sign up, create their own sessions (e.g. "CR Election – BSCS"), import earlier votes from CSV/Excel, and download the full list as Excel at the end.

Stack: plain HTML/JS + 4 Vercel serverless functions + Neon Postgres. Only one npm dependency (`postgres`). Tables are created automatically on first use.

## Deploy on Vercel (≈5 minutes, free)

1. Put this folder in a GitHub repo (or run `npx vercel` inside it).
2. In Vercel: **Add New → Project →** import the repo. Framework preset: **Other**. No build command needed. Click **Deploy**.
3. In the project: **Storage → Create Database → Neon (Postgres)** → connect it to the project.
   This adds `DATABASE_URL` automatically.
4. (Recommended) **Settings → Environment Variables →** add `AUTH_SECRET` = any long random string.
5. **Deployments → Redeploy** so the new variables are picked up. Open the URL, sign up, done.

## Load the initial list (30 Sep 2026)

Create a session → **Import CSV / Excel** → choose `seed_votes_2026-09-30.csv` → **Import**.
Any CSV/Excel works: the app finds the column with roll numbers and uses a date/time column if present
(otherwise it uses the time you pick in the import dialog). Roll numbers already in the session are skipped.

## Excel export

**Download Excel** gives a workbook with two sheets:
- *Voters*: #, Roll Number, Program, Batch, Date, Time, Voted At (UTC), Source
- *Summary*: votes per program + total

## Run locally

```bash
npm install
DATABASE_URL=postgres://user:pass@localhost:5432/db node dev-server.js   # http://localhost:3000
```

## Notes
- Roll format accepted: 2–6 letters + 2-digit batch + 3-digit serial. Spaces/dashes and lowercase are cleaned automatically.
- Several devices can log into the same account and work on the same session at once; the duplicate check is done in the database, so two people entering the same roll number at the same moment can't both add it. The table refreshes every 15 s.
- Each account's sessions are private to that account.
