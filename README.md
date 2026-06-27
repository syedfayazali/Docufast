# QwikPrint Cloud

The public-facing half of QwikPrint: upload page, Paytm payment, job storage.
Deployed to Vercel so it works from anywhere, on any phone, on any network.

Printing itself does **not** happen here — see the separate `qwikprint-agent`
folder, which runs on your laptop and is the only thing that can reach your
printer. This app and that agent talk to each other over the internet.

## One-time setup

### 1. Install the Vercel CLI

```
npm install -g vercel
vercel login
```

### 2. Deploy

From inside this folder:
```
vercel --prod
```
First run will ask a few setup questions (link to a new project — accept the defaults). It'll give you a URL like `https://qwikprint-cloud.vercel.app` — that's your permanent public address. Note it down.

### 3. Add a database (for job storage)

Vercel's native "Postgres" product was retired — Postgres now comes through the **Marketplace**. In the Vercel dashboard, open this project → **Storage** tab → **Connect Database** → choose a Postgres provider (**Neon** is the free, simplest option) → connect it to this project. This injects a `DATABASE_URL` environment variable automatically — no manual connection string, and no migration step (the table is created automatically the first time the app touches the database).

### 4. Add Blob storage (for uploaded files)

Same **Storage** tab → **Create Store** → choose **Blob** → connect it to this project. This injects `BLOB_READ_WRITE_TOKEN` automatically.

### 5. Set the remaining environment variables

Project → **Settings** → **Environment Variables**, add:

| Name | Value |
|---|---|
| `PAYTM_MID` | your Paytm test (or live) Merchant ID |
| `PAYTM_MERCHANT_KEY` | your Paytm test (or live) Merchant Key |
| `PAYTM_ENV` | `staging` (or `production` once you're live) |
| `AGENT_KEY` | a long random secret — generate one with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |

### 6. Redeploy so the new env vars take effect

```
vercel --prod
```

### 7. Try it

- `https://your-app.vercel.app/` — upload page (this is what the QR code on `/signage` points to)
- `https://your-app.vercel.app/admin` — owner dashboard (paste your `AGENT_KEY` into the "Owner key" box to enable the retry button)
- `https://your-app.vercel.app/signage` — QR code customers scan

Now go set up `qwikprint-agent` on your laptop — nothing will actually print until that's running.

## What's different from the laptop-only version

- Files live in Vercel Blob storage instead of the local disk, and jobs live in a real Postgres database instead of `jobs.json` — both survive restarts/redeploys and work from any device.
- The 25MB upload cap from before is now 4MB (base64-encoded), since Vercel's serverless functions have a smaller request-size limit than a plain Node server. That covers the vast majority of documents; bigger files would need a different upload method (direct browser-to-storage upload) — ask if you hit this limit in practice.
- Printing is asynchronous: payment confirmation just marks a job "paid"; the separate agent polls for paid jobs and prints them, usually within `POLL_INTERVAL_MS` (default 5 seconds) of payment.
- The `/kiosk` page is gone — there's no local code-entry step anymore. The admin dashboard's "Retry" button replaces it for the rare case a print fails.
