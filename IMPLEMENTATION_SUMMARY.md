# Cloudflare conversion summary

## Replaced

- Node HTTP server and JSON-file storage
- Render Docker deployment and persistent disk
- Server-sent events that required a continuously open Node response

## Added

- Cloudflare Worker entrypoint in `src/worker.js`
- Cloudflare D1 persistence in `src/db.js`
- Web Crypto signed staff sessions in `src/auth.js`
- Automatic D1 resource provisioning through `wrangler.toml`
- Runtime-generated presenter QR codes based on the deployed origin
- Lightweight two-second polling for audience, moderator, and facilitator status
- Cloudflare dashboard setup guide
- Static QR regeneration utility for printed assets

## Preserved

- audience submission lifecycle: pending, approved, rejected
- moderator passcode gate and approve/reject queue
- facilitator approved dataset, finalize, reopen, and reset controls
- finalization lock for new submissions
- independent locked lab activities and slide-specific codes
- presentation content and styling

## Validation completed

- `npm test`: 5 passing tests
- `npm run check`: all JavaScript syntax checks passed
- D1/SQLite schema and lifecycle test passed
- HTML local asset references passed
- presenter duplicate-ID and QR script checks passed
