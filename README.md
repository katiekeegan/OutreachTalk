# D1 first-request fix

This revision changes database initialization so each schema statement runs separately.
It also removes SQL triggers and updates the exercise timestamp explicitly in Worker code.

Replace these repository files:

- `src/db.js`
- `src/worker.js`
- `migrations/0001_initial.sql`

Commit to `main`. Cloudflare Git integration should deploy the commit automatically.
Then open `/api/state` on the Worker address.
