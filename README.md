# What Will the Model Say Next?

An interactive, browser-based museum presentation about how training data shapes autoregressive language models. It was designed for an outreach talk at the National Museum of Mathematics, with activities that work for a mixed-age audience.

## What is included

- Nine slide-like scenes with keyboard, button, swipe, and fullscreen navigation
- A fully local next-word predictor implemented as an adjustable n-gram model
- Editable training corpora for story, mathematics, and space language
- Live probability bars, generation, context length, and temperature controls
- Interactive demonstrations of frequency, missing coverage, representation imbalance, distribution shift, and sampling
- Presenter notes that can be toggled on screen
- Responsive and print-friendly styling
- No dependencies, API keys, model downloads, or build step

## Run locally

Open `index.html` directly in a modern browser, or serve the folder locally:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Presenting

- Left/right arrows: previous or next slide
- Space / Page Down: next slide
- Page Up: previous slide
- Home / End: first or last slide
- **Notes**: toggle facilitator notes
- **Fullscreen**: enter browser fullscreen
- On touch devices, swipe left or right

## Core interactive model

The model in `app.js` is intentionally transparent. It:

1. tokenizes the editable training text;
2. counts which words follow each context;
3. converts counts into a probability distribution;
4. adjusts that distribution with temperature; and
5. samples one word at a time to generate a continuation.

It is an n-gram teaching model, not a neural network. That makes the relationship between examples and probabilities visible enough for a museum audience to inspect directly. The presentation connects this mechanism to the broader principle used by autoregressive neural language models: predict a next token from prior context, append it, and repeat.

## Suggested 25-minute flow

1. **Warm-up prediction** — 2 minutes
2. **Autoregressive loop** — 3 minutes
3. **Train the tiny model** — 7 minutes
4. **Frequency and coverage experiments** — 5 minutes
5. **Representation and distribution shift** — 5 minutes
6. **Sampling and final challenge** — 3 minutes

For a shorter talk, use slides 1, 2, 3, 4, 6, and 9.

## Customizing the content

- Edit the text in the `CORPORA` object near the top of `app.js`.
- Edit slide wording and speaker notes in `index.html`.
- Change visual variables such as `--accent` and `--paper` at the top of `styles.css`.

## GitHub Pages

This is a static site. To publish it with GitHub Pages, configure Pages to deploy from the repository's `main` branch and root folder after the feature branch is merged.

## License

MIT
