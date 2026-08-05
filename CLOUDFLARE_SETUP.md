# Cloudflare setup: click-by-click

This setup uses the Workers Free plan and does not need a Render account.

## Before starting

Have these ready:

- access to the GitHub repository `katiekeegan/OutreachTalk`;
- a moderator passcode you invent;
- a different facilitator passcode;
- a long random session secret, ideally 32 or more characters.

Do not put any of those values in GitHub files.

## 1. Create the free Cloudflare account

1. Open Cloudflare and create an account.
2. Choose the Workers Free plan when asked.
3. Open **Workers & Pages** in the dashboard.
4. Configure the account's `workers.dev` subdomain when Cloudflare asks. This becomes part of the temporary public address.

## 2. Import the GitHub repository

1. In **Workers & Pages**, choose **Create application** or **Create**.
2. Choose **Import a repository**.
3. Connect GitHub.
4. Grant Cloudflare access to `katiekeegan/OutreachTalk`.
5. Select that repository and the `main` branch.
6. Leave the root directory empty or `/`.
7. Leave the build command empty.
8. Keep the deploy command as:

   ```text
   npx wrangler deploy
   ```

9. Start the deployment.

`wrangler.toml` already tells Cloudflare which Worker source file and static directory to use. Wrangler's resource provisioning creates and binds the D1 database during this first deployment.

## 3. Find the Worker

After the build succeeds:

1. Open the new Worker named **outreach-talk**.
2. Copy its workers.dev address. It will resemble:

   ```text
   https://outreach-talk.your-subdomain.workers.dev
   ```

At this moment the public pages can load, but staff sign-in will report missing secrets. That is expected.

## 4. Add the three private secrets

Inside the Worker:

1. Open **Settings**.
2. Open **Variables and Secrets**.
3. Add these as encrypted secrets, not plain-text variables:

   - `MODERATOR_PASSCODE`
   - `FACILITATOR_PASSCODE`
   - `SESSION_SECRET`

4. Save each value.
5. Redeploy the latest version when Cloudflare prompts you. If it does not prompt, open **Deployments** and choose **Retry deployment** or push a tiny README change to GitHub.

Good passcodes are memorable to staff but hard to guess. The session secret should be a long random string and is not something you need to type during the talk.

## 5. Confirm the D1 binding

Normally this is automatic.

1. Open the Worker's **Bindings** or **Settings → Bindings** area.
2. Confirm a D1 binding named `DB` exists.
3. Open **Storage & Databases → D1** and confirm the automatically created database exists.

If the first build says the `DB` binding is missing, add a D1 database manually, bind it to the Worker with the variable name `DB`, and redeploy. The application creates its tables automatically on the first `/api/state` request.

## 6. Test the audience route

Open the bare Worker address:

```text
https://outreach-talk.your-subdomain.workers.dev/
```

Submit:

```text
the museum is full of surprising patterns
```

It should appear as **pending**.

## 7. Test the moderator route

Open:

```text
https://outreach-talk.your-subdomain.workers.dev/moderator/
```

1. Enter `MODERATOR_PASSCODE`.
2. Approve the test sentence.
3. Confirm it leaves the pending queue and appears in decision history as approved.

## 8. Test the facilitator route

Open:

```text
https://outreach-talk.your-subdomain.workers.dev/play/
```

1. Find the live dataset panel.
2. Confirm the approved sentence appears.
3. Select **Staff sign in** and enter `FACILITATOR_PASSCODE`.
4. Select **Finalize submissions**.
5. Return to the audience page and try another submission. It should be blocked.
6. Reopen the exercise from the facilitator page.

## 9. Test the QR code

On the facilitator page, display an interactive slide and scan the shown QR code with a phone. The QR is built from the address currently in the browser, so it should open the same Worker rather than an old GitHub Pages address.

## 10. Add a custom domain later

Do not do this until workers.dev testing passes.

A dedicated subdomain such as `talk.katiekeegan.org` is simpler than keeping `/OutreachTalk` on the old GitHub Pages site. In the Worker, open **Domains**, add the subdomain, and follow Cloudflare's DNS instructions.

The on-screen QR code will automatically use the custom domain when the presentation is opened there.
