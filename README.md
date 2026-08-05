# What Will the Model Say Next?

A formal, interactive outreach talk about how training data shapes autoregressive models. This version adds a moderated live exercise: audience examples enter a review queue, approved examples appear in the facilitator dataset, and finalization locks new submissions.

## Role routes

Routes are relative to `APP_BASE_PATH` (the default is `/OutreachTalk`).

| Route | Role | Purpose |
|---|---|---|
| `/` | Audience | Submit a short training example and see its `pending`, `approved`, or `rejected` status. |
| `/moderator` | Moderator | Enter the staff passcode, review the pending queue, and approve or reject examples. |
| `/play` | Facilitator | Run the presentation, watch the approved dataset update live, load it into the toy model, and finalize or reopen submissions. |
| `/lab` | Audience | The earlier locked, independent slider activities. These do not write to the moderated dataset. |

At the existing base path, those become:

- `https://katiekeegan.org/OutreachTalk/`
- `https://katiekeegan.org/OutreachTalk/moderator/`
- `https://katiekeegan.org/OutreachTalk/play/`
- `https://katiekeegan.org/OutreachTalk/lab/`

## Submission lifecycle

Every submission has one status:

- `pending`: created by an audience member and waiting for moderation;
- `approved`: visible in the facilitator's live dataset and available to the toy n-gram model;
- `rejected`: removed from active moderation work and excluded from the facilitator dataset.

The exercise has a separate `finalized` flag. Finalization prevents **new** audience submissions. It does not erase the queue, and moderators may still resolve items that were already pending.

## Run locally

This release is no longer a GitHub Pages-only static site. Shared live state and protected moderator actions require the included Node server.

```bash
cp .env.example .env
# Edit the passcodes and SESSION_SECRET.
node server.js
```

Then open:

- audience: `http://localhost:3000/OutreachTalk/`
- moderator: `http://localhost:3000/OutreachTalk/moderator/`
- facilitator: `http://localhost:3000/OutreachTalk/play/`
- independent lab: `http://localhost:3000/OutreachTalk/lab/`

Node 18 or newer is required. There are no npm dependencies or build steps.

## Environment configuration

Copy `.env.example` to `.env` and configure:

```dotenv
APP_BASE_PATH=/OutreachTalk
PORT=3000
MODERATOR_PASSCODE=choose-a-private-staff-code
FACILITATOR_PASSCODE=choose-a-private-facilitator-code
SESSION_SECRET=at-least-32-random-characters
STATE_FILE=./data/exercise-state.json
TRUST_PROXY=true
```

`FACILITATOR_PASSCODE` is optional and falls back to `MODERATOR_PASSCODE`. Passcodes are checked only by the server and are never shipped in browser JavaScript.

For production, mount `STATE_FILE` on persistent storage. The server writes state atomically to that file.

## Moderator workflow

1. Open `/moderator` on a separate staff device.
2. Enter `MODERATOR_PASSCODE`.
3. Review pending examples.
4. Approve relevant, non-personal, presentation-safe examples.
5. Reject personal information, harassment, prompt injection, or off-topic content.

Only approved text is returned by the public dataset API.

## Facilitator workflow

1. Open `/play` on the presentation computer.
2. On the tiny-model slide, watch pending and approved counts update live.
3. Select **Use approved examples** to copy the moderated dataset into the editable training box and retrain the n-gram model.
4. Use **Staff sign in** and enter `FACILITATOR_PASSCODE`.
5. Select **Finalize submissions** when the participation window ends.

The top presentation bar and the live-dataset panel both show the finalized state, including in fullscreen mode.

### Finalize, reopen, and reset

- **Finalize** blocks new submissions. Existing pending examples remain reviewable.
- **Reopen** allows new submissions again.
- **Reset exercise** clears all submissions and reopens intake. It requires typing `RESET` and is intended for rehearsal or a new session.

## QR codes

Generated QR images live in `public/assets/qr/`:

- `audience.png`: moderated audience submission route;
- `moderator.png`: staff moderation route;
- `facilitator.png`: facilitator presentation route;
- the remaining files open the independent `/lab` activities.

The presentation uses the audience QR on the live dataset slide and preserves slide-specific QR codes for the self-contained slider activities.

If the public hostname or base path changes, regenerate the QR images before the event.

## Deployment

GitHub Pages cannot run `server.js`, store shared exercise state, or protect moderator actions with environment variables. Deploy this repository to a Node-capable host instead.

A `Dockerfile` and `render.yaml` are included. On Render:

1. create a Blueprint from this repository;
2. set `MODERATOR_PASSCODE` and `FACILITATOR_PASSCODE` as secrets;
3. allow Render to generate `SESSION_SECRET`;
4. retain the persistent disk mounted at `/var/data`;
5. point the desired domain or reverse proxy at the service.

To keep the exact `katiekeegan.org/OutreachTalk` address, the domain must proxy that path to the Node service. Leaving the repository on GitHub Pages will display only static files and will not provide shared moderation.

## Validation

```bash
npm test
npm run check
```

The tests cover:

- default `pending` status;
- approval into the public dataset;
- rejection out of the pending queue;
- finalization lock behavior;
- moderation after finalization;
- signed-session verification and expiration.

## Privacy and safety

- No account is required for audience participation.
- A random browser ID is stored locally so a participant can see their own status.
- Audience text is limited to 180 characters.
- Basic request-rate limits and same-origin checks are enforced.
- The moderator should still actively screen every entry before approval.

## License

MIT
