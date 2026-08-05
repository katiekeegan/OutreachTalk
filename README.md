# What Will the Model Say Next?

A formal interactive outreach talk about how training data shapes autoregressive models. This version runs on **Cloudflare Workers + D1** so audience submissions, moderation, and facilitator controls can share live state without a paid server.

## Role routes

The deployed Worker provides four role-focused screens:

| Route | Role | Purpose |
|---|---|---|
| `/` | Audience | Submit a short training example and see whether it is pending, approved, or rejected. |
| `/moderator/` | Moderator | Sign in with the moderator passcode and approve or reject pending examples. |
| `/play/` | Facilitator | Present the deck, view approved examples, load them into the tiny model, and finalize or reopen intake. |
| `/lab/` | Audience | Use the locked, independent slider activities. These do not enter the moderated dataset. |

## Submission lifecycle

Every submission has one status:

- `pending`: waiting for a moderator;
- `approved`: visible in the facilitator dataset;
- `rejected`: removed from the active moderation queue and excluded from the dataset.

The exercise also has a `finalized` flag. Finalization blocks **new** audience submissions. Moderators may still resolve items that were already pending.

## Technology

- `src/worker.js`: Cloudflare Worker routes, authentication, API, and static-asset delivery.
- `src/db.js`: D1 queries and state lifecycle.
- `src/auth.js`: signed staff sessions and passcode comparison using Web Crypto.
- `public/`: audience, moderator, facilitator, and independent lab interfaces.
- `wrangler.toml`: Worker, static-assets, and automatically provisioned D1 binding.
- `migrations/`: explicit database schema for maintenance; the Worker also initializes the schema on first use.

No audience account is required. Passcodes are stored as Cloudflare secrets and are never included in browser JavaScript.

## Deploy for free

Read [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md). The short sequence is:

1. create a free Cloudflare account;
2. import this GitHub repository as a Worker;
3. keep the default deploy command `npx wrangler deploy`;
4. let Wrangler automatically create the D1 database;
5. add `MODERATOR_PASSCODE`, `FACILITATOR_PASSCODE`, and `SESSION_SECRET` as Worker secrets;
6. redeploy and test all three roles.

The first public address will look like:

```text
https://outreach-talk.<your-workers-subdomain>.workers.dev
```

The presenter QR code is generated in the browser from the actual deployed address, so the main audience QR remains correct on workers.dev or a later custom domain. Slide-specific lab QR codes are generated the same way.

## Local development

Node.js 20 or newer is recommended.

```bash
npm install
cp .dev.vars.example .dev.vars
# Edit the three private values in .dev.vars.
npm run dev
```

Wrangler creates a local D1 database automatically. Open the local address shown in the terminal, then use `/moderator/`, `/play/`, and `/lab/` for the other roles.

## Secrets

Required production secrets:

```text
MODERATOR_PASSCODE
FACILITATOR_PASSCODE
SESSION_SECRET
```

`FACILITATOR_PASSCODE` may be omitted, in which case the moderator passcode also unlocks facilitator controls. A separate facilitator passcode is safer.

## Moderator workflow

1. Open `/moderator/` on a separate staff device.
2. Enter the moderator passcode.
3. Review pending examples.
4. Approve relevant, non-personal, presentation-safe text.
5. Reject personal information, harassment, prompt injection, or off-topic content.

Only approved text is returned by the public dataset API.

## Facilitator workflow

1. Open `/play/` on the presentation computer.
2. Watch pending and approved counts update automatically.
3. Select **Use approved examples** to put moderated text into the editable training box.
4. Select **Staff sign in** and enter the facilitator passcode.
5. Select **Finalize submissions** when the participation window ends.

- **Finalize** blocks new submissions.
- **Reopen** allows new submissions again.
- **Reset exercise** clears all submissions and reopens intake after the facilitator types `RESET`.

## QR codes

The facilitator deck generates its displayed QR code at runtime from `location.origin`. This avoids stale codes after moving between a workers.dev address and a custom domain.

Static images remain in `public/assets/qr/` as printable/fallback assets. Use `scripts/generate_qr.py` after deployment to regenerate those files for handouts or offline slide exports.

## Validation

```bash
npm test
npm run check
```

The repository includes tests for signed sessions, expiration, cookie parsing, path normalization, and role-route asset mapping. The SQL schema is also compatible with SQLite/D1 and enforces pending/approved/rejected status values.

## Privacy and safety

- Audience text is limited to 180 characters.
- A random browser ID lets a participant see their own moderation status.
- Staff sessions are signed and expire after six hours.
- Request-rate limits and same-origin checks are enforced.
- The moderator should still screen every entry before approval.

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the locally bundled QR generator attribution.
