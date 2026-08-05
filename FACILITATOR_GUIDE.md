# Facilitator Guide

## Central message

A model's output is shaped by the examples it learned from. Training data affects what is common, what is missing, which associations are easy to reproduce, and how well the model handles a new situation.

## Audience participation prompts

### Slide 1 — Predict the prediction
Ask visitors to complete “Once upon a…” before clicking. Follow with: “Did you use logic, or did you use a pattern you have seen many times?”

### Slide 3 — Program with examples
Invite one visitor to choose a corpus and another to choose a prompt. Add a repeated sentence to the text area and retrain. Ask the audience to predict which probability will rise.

Useful edits:

- Repeat `once upon a triangle` five times.
- Remove every sentence containing `time`.
- Add `the museum is mathematical` several times.
- Put one surprising phrase in the dataset ten times.

### Slide 4 — Make a distribution
Invite a visitor to move the frequency sliders. Ask: “Are we changing the algorithm?” The answer is no; only the examples change.

### Slide 5 — Find a hole
Begin with only circle and triangle books selected. Ask the model about a Möbius strip, then add topology coverage and try again.

### Slide 6 — Discuss representation
State clearly that the display is a toy count model. Real systems can inherit skew through collection, labeling, filtering, objectives, and human feedback—not just direct repetition.

### Slide 7 — Change worlds
Ask for meanings of “plane” before selecting each dataset. Point out that a familiar token can have a different continuation in a different domain.

### Slide 8 — Sampling
Run several low-temperature samples, then several high-temperature samples. Ask whether higher temperature made the model more knowledgeable. It did not; it made sampling less conservative.

## Avoiding common misconceptions

- **“Models just copy.”** They can sometimes reproduce training fragments, but generation is generally a repeated probability calculation over possible next tokens.
- **“The most likely answer is the true answer.”** Probability under the model is not the same as truth in the world.
- **“More data fixes everything.”** More data can repeat errors or imbalance. Relevance, coverage, quality, consent, and evaluation matter.
- **“This n-gram model is how ChatGPT works internally.”** It is an analogy that exposes the same next-token objective. Modern language models use neural networks and much richer representations.

## Optional physical activity

Give visitors colored cards representing next words. Build a “dataset” by placing repeated cards in a bag. Draw one card to sample a next word. Add or remove cards and repeat. Then explain that temperature acts like changing how strongly the draw favors common cards.

## Technical notes

Everything runs in the browser. No visitor text is sent to a server. Reloading the page resets the examples.

## Audience phone flow

Keep the presenter deck at `https://katiekeegan.org/OutreachTalk/`. Ask the audience to scan the opening QR once and keep `https://katiekeegan.org/OutreachTalk/play/` open.

The audience page does not show an activity menu. Reveal each activity only when you reach its slide:

| Slide | Activity | Code |
|---|---|---:|
| 3 | Tiny predictor | 7316 |
| 4 | Frequency | 2049 |
| 5 | Coverage | 5827 |
| 6 | Representation | 4183 |
| 7 | Context | 9672 |
| 8 | Temperature | 3506 |
| 9 | Final challenge | 6241 |

Each slide also displays a direct QR code for late arrivals. Allow roughly 20–30 seconds for a phone experiment, then demonstrate the same action on the main screen. Never make the talk depend on receiving audience responses.

Use the **Hide audience QR** control when you want the room focused only on the projected explanation.
