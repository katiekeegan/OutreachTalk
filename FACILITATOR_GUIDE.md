# Facilitator Guide: Moderated Live Dataset Exercise

## Roles

Use three devices or browser profiles:

- **Audience** — `/`
- **Moderator** — `/moderator/`
- **Facilitator/presentation** — `/play/`

The independent phone experiments remain at `/lab/`.

## Before the room opens

1. Open the deployed Cloudflare Worker and verify the public URL.
2. Confirm that the audience QR opens the submission page over HTTPS.
3. Open the moderator queue on a separate staff device and sign in.
4. Open the facilitator deck and sign in under **Staff sign in**.
5. Use **Reset exercise** to clear rehearsal data.
6. Submit, approve, reject, and finalize one test example end to end.
7. Reopen and reset before admitting the audience.

Do not use the old GitHub Pages address for the moderated exercise. Open the Cloudflare Worker address so all devices share the D1 database.

## Suggested formal-talk sequence

### 1. Establish the idea without phones

Ask the room to predict the word after “Once upon a…”. Make the central point first: likely words come from repeated patterns in data.

### 2. Invite contributions

On the tiny-model slide, show the QR and say:

> Submit one short sentence that could belong in a model’s training data. A moderator will review it before it appears here. Phones are optional; I will continue the demonstration either way.

Give the room a specific prompt, such as:

- “The museum is…”
- “Math can be…”
- “A pattern is…”

Specific prompts produce a dataset that is easier to compare and explain.

### 3. Keep speaking while moderation happens

Do not wait silently for submissions. Continue explaining autoregression while the moderator works. The pending and approved counters provide enough feedback to know when the dataset is usable.

### 4. Load approved examples

Select **Use approved examples**. This copies only approved sentences into the training box and retrains the toy model.

Ask:

- Which words became likely?
- Which repeated phrase had the strongest effect?
- What did the moderator remove from the model’s possible training history?

### 5. Finalize the exercise

When the submission window ends, select **Finalize submissions**. New audience attempts receive a clear finalized message. If pending examples remain, the interface warns you before finalizing; the moderator can still resolve those existing entries.

### 6. Continue with independent activities

Later slides use the locked `/lab/` experiments. These run independently on each phone and do not alter the shared facilitator dataset.

## Quiet-audience fallback

The presentation remains complete with zero submissions:

1. narrate one or two prepared examples;
2. use the editable training text on the facilitator screen;
3. move the frequency and temperature controls yourself;
4. frame phones as optional exploration rather than a requirement.

Never pause the formal talk indefinitely while waiting for participation. Set a time box of roughly 30–45 seconds.

## Moderator approval standard

Approve examples that are:

- relevant to the current prompt;
- short enough to read aloud;
- free of personal information;
- suitable for a mixed-age museum audience;
- useful for illustrating frequency, coverage, context, or bias.

Reject examples containing:

- names, contact information, or other personal data;
- harassment, slurs, sexual content, threats, or graphic content;
- instructions aimed at disrupting the system;
- unrelated advertising or repeated spam;
- text that would be uncomfortable to project publicly.

## Finalization semantics

Finalization means **submission intake is closed**. It does not automatically approve or reject remaining pending items. This lets the facilitator keep the talk moving while the moderator finishes the existing queue.

The presentation shows finalized state in two places:

- the top control bar;
- the live-dataset panel on the tiny-model slide.

## Recovery procedures

- Wrong example approved: reject it from the moderator history; it disappears from the public approved dataset on the next live update.
- Finalized too early: select **Reopen submissions**.
- Need a clean rehearsal or second session: select **Reset exercise**, type `RESET`, and confirm.
- Cloudflare unavailable: continue with the local presenter controls. The conceptual talk and independent slider demonstrations still work.
