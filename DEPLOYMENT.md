# Deployment

## Why GitHub Pages is insufficient

The moderated exercise requires a shared process that can:

- store submissions from many devices;
- keep moderation status synchronized;
- protect approval, rejection, and finalization behind server-side passcodes;
- reject new submissions after finalization.

GitHub Pages serves static files only and cannot provide those capabilities.

## Render Blueprint

The included `render.yaml` defines a Docker web service with a persistent disk.

1. Push this repository to GitHub.
2. In Render, create a new Blueprint and select the repository.
3. Set secret values for `MODERATOR_PASSCODE` and `FACILITATOR_PASSCODE`.
4. Deploy.
5. Confirm these routes:
   - `/OutreachTalk/api/state`
   - `/OutreachTalk/`
   - `/OutreachTalk/moderator/`
   - `/OutreachTalk/play/`
6. Configure HTTPS and the desired domain.

## Existing custom path

To preserve `https://katiekeegan.org/OutreachTalk/`, configure the server or CDN responsible for `katiekeegan.org` to proxy `/OutreachTalk/*` to this Node service. A GitHub Pages CNAME by itself cannot proxy a subpath to a dynamic backend.

A simpler alternative is to use a dedicated subdomain such as `talk.katiekeegan.org` and set:

```dotenv
APP_BASE_PATH=
```

If the public URL changes, regenerate every QR code in `public/assets/qr/`.

## Persistent state

The production `STATE_FILE` should live on persistent disk. The included Render configuration uses:

```dotenv
STATE_FILE=/var/data/exercise-state.json
```

Back up or reset this file between events as appropriate.
