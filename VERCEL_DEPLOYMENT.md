# Deploying to Vercel

This app uses Neon Postgres for records and Slack credentials, and a **private** Vercel Blob store for evidence uploads. The app creates its Postgres tables on the first API request. Local development continues to use SQLite and the local `data/` directory unless `DATABASE_URL` is set.

## 1. Create the hosted storage

1. Create a Neon Postgres database from the Vercel Marketplace or Neon Console. Copy its pooled Postgres connection string; it should start with `postgresql://`.
2. In Vercel, open the project’s **Storage** tab and create a Blob store with **Private** access. Connect it to the project’s **Production** environment and confirm `BLOB_READ_WRITE_TOKEN` is available; the app uses it for private uploads and reads.

## 2. Import and configure the project

1. Import this Git repository into Vercel and select the Next.js framework preset.
2. Set the Node.js version to **22.x** (the app requires Node.js 22.13 or newer).
3. Add these environment variables for Production:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | The Neon pooled Postgres connection string |
   | `APP_PASSWORD` | A long, unique password for this private workboard |
   | `APP_URL` | The stable public URL, e.g. `https://workboard.example.com`, with no trailing slash |
   | `COOKIE_SECURE` | `true` |
   | `BLOB_READ_WRITE_TOKEN` | Supplied by the connected private Blob store |

   Do not set `ALLOW_LOCAL_NO_AUTH` in Vercel. Keep secrets in Vercel’s environment-variable settings, not in Git.

4. Deploy. Vercel should run `npm run build` automatically. On first use, the API creates the required database tables.

Do not point Preview deployments at the production database or Blob store. If you want working previews, create a separate Neon branch/database and private Blob store, then configure the Preview environment with those separate credentials.

## 3. Add a custom domain and optional Slack

Add your domain in Vercel and update `APP_URL` to that exact HTTPS origin. Redeploy after changing environment variables.

If you use Slack imports, configure the Slack OAuth redirect URL to exactly `${APP_URL}/api/slack`, then add `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` in Vercel. Connect Slack again from Settings after deployment; OAuth tokens are stored in the hosted database.

## 4. Move existing local data

Deployment does not automatically copy local SQLite data or files:

1. In the existing local app, use **Settings → JSON backup**.
2. In the deployed app, use **Settings → Import JSON** and select that backup.
3. Evidence file contents are not included in JSON backups. Download existing evidence from the local app before switching over, then upload it again to the corresponding checks in Vercel.
4. Reconnect Slack in the deployed app; the prior local Slack token is not part of the JSON backup.

Keep a private copy of the JSON backup and any evidence files. Future JSON backups preserve records, while private Blob storage preserves uploaded file contents.
