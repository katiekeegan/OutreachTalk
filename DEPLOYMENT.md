# Deployment

The production target is Cloudflare Workers with a D1 database. Follow [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) for the dashboard steps.

## Why GitHub Pages is no longer enough

The moderated exercise needs a shared process that can store submissions, synchronize status, keep staff passcodes server-side, and lock new intake after finalization. GitHub Pages serves static files only and cannot perform those jobs.

## Cloudflare resources

The repository declares:

- one Worker named `outreach-talk`;
- one static-assets binding named `ASSETS`;
- one automatically provisioned D1 binding named `DB`;
- three runtime secrets.

Wrangler creates and attaches the D1 database during the first deployment because the binding intentionally has no account-specific database ID.

## Database initialization

The Worker runs idempotent `CREATE TABLE IF NOT EXISTS` statements on first API use. The same schema is also recorded in `migrations/0001_initial.sql` for future maintenance.

## Routes

With the default root deployment:

- `/` audience
- `/moderator/` moderator
- `/play/` facilitator
- `/lab/` independent activities
- `/api/state` health/state endpoint

Set `APP_BASE_PATH` only when intentionally deploying under a path prefix. A dedicated workers.dev address or subdomain is simpler and should leave it empty.

## Custom domain

After workers.dev testing succeeds, a dedicated subdomain such as `talk.katiekeegan.org` can point directly to the Worker. The presenter creates QR codes from the current origin, so no application-code change is needed when the domain changes.
