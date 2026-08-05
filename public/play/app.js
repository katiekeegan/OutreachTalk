"use strict";

const CORPORA = {
  story: `once upon a time there was a curious fox
once upon a time there was a brave child
once upon a winter night the stars were bright
once upon a hill stood a tiny castle
the curious fox followed a silver path
the brave child opened the hidden door
the story ends with a surprising discovery
a dragon guarded the old castle
a wizard drew a glowing circle`,
  math: `once upon a triangle we measured three angles
once upon a number line zero met one
the shape is a circle
the shape is a triangle
the shape is a square
a circle has constant curvature
a triangle has three sides
a square has four equal sides
math can be playful
math can be surprising
math can be beautiful
a pattern repeats when a rule repeats
a mobius strip has one side and one edge`,
  space: `once upon a distant planet the sky was violet
once upon a star a telescope found a shadow
the rocket crossed the quiet sky
the planet moved around its star
the astronaut studied a glowing crystal
space can be vast
space can be surprising
a comet left a bright trail
the moon reflected sunlight`,
  mixed: `once upon a time there was a curious fox
once upon a triangle we measured three angles
once upon a distant planet the sky was violet
the shape is a circle
the shape is a triangle
math can be playful
space can be vast
the museum is open
the museum is surprising
the museum is full of patterns
a story can contain a puzzle
a puzzle can tell a story`
};

class NGramModel {
  constructor(order = 2) {
    this.order = order;
    this.tables = new Map();
    this.unigrams = new Map();
    this.vocabulary = new Set();
    this.tokenCount = 0;
  }

  static tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[’]/g, "'")
      .match(/[a-z0-9']+|[.!?,;:]/g) || [];
  }

  train(text, order = this.order) {
    this.order = order;
    this.tables.clear();
    this.unigrams.clear();
    this.vocabulary.clear();

    const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const sequences = lines.length ? lines : [text];

    for (const sequence of sequences) {
      const words = NGramModel.tokenize(sequence);
      if (!words.length) continue;
      const padded = Array(this.order).fill('<s>').concat(words, ['</s>']);

      for (const word of words) {
        this.vocabulary.add(word);
        this.unigrams.set(word, (this.unigrams.get(word) || 0) + 1);
      }

      for (let i = this.order; i < padded.length; i++) {
        for (let contextSize = 0; contextSize <= this.order; contextSize++) {
          const context = padded.slice(i - contextSize, i).join(' ');
          const next = padded[i];
          if (!this.tables.has(context)) this.tables.set(context, new Map());
          const bucket = this.tables.get(context);
          bucket.set(next, (bucket.get(next) || 0) + 1);
        }
      }
    }

    this.tokenCount = [...this.unigrams.values()].reduce((sum, count) => sum + count, 0);
    return this;
  }

  getCounts(prompt) {
    const tokens = NGramModel.tokenize(prompt);
    for (let size = Math.min(this.order, tokens.length); size >= 0; size--) {
      const context = tokens.slice(-size).join(' ');
      const counts = this.tables.get(context);
      if (counts && counts.size) return { counts, context: context || '(any context)' };
    }
    return { counts: new Map(), context: '(no match)' };
  }

  predict(prompt, temperature = 1, limit = 8) {
    const { counts, context } = this.getCounts(prompt);
    const entries = [...counts.entries()].filter(([word]) => word !== '</s>');
    if (!entries.length) return { predictions: [], context };

    const safeTemperature = Math.max(0.05, Number(temperature) || 1);
    const weighted = entries.map(([word, count]) => ({
      word,
      count,
      weight: Math.pow(count, 1 / safeTemperature)
    }));
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    const predictions = weighted
      .map(item => ({ ...item, probability: item.weight / total }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);
    return { predictions, context };
  }

  sample(prompt, temperature = 1) {
    const { counts } = this.getCounts(prompt);
    const entries = [...counts.entries()];
    if (!entries.length) return null;
    const safeTemperature = Math.max(0.05, Number(temperature) || 1);
    const weighted = entries.map(([word, count]) => [word, Math.pow(count, 1 / safeTemperature)]);
    const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = Math.random() * total;
    for (const [word, weight] of weighted) {
      cursor -= weight;
      if (cursor <= 0) return word;
    }
    return weighted[weighted.length - 1][0];
  }

  generate(prompt, count = 12, temperature = 1) {
    const words = NGramModel.tokenize(prompt);
    const generated = [...words];
    for (let i = 0; i < count; i++) {
      const next = this.sample(generated.join(' '), temperature);
      if (!next || next === '</s>') break;
      generated.push(next);
    }
    return generated.join(' ');
  }
}

const slides = [...document.querySelectorAll('.slide')];
const slideCounter = document.getElementById('slideCounter');
const progressFill = document.getElementById('progressFill');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const audienceDock = document.getElementById('audienceDock');
const audienceToggle = document.getElementById('audienceToggle');
const audienceDockTitle = document.getElementById('audienceDockTitle');
const audienceDockKicker = document.getElementById('audienceDockKicker');
const audienceQrImage = document.getElementById('audienceQrImage');
const audienceCodeRow = document.getElementById('audienceCodeRow');
const audienceCode = document.getElementById('audienceCode');
const audienceDockCopy = document.getElementById('audienceDockCopy');
const audienceShortUrl = document.getElementById('audienceShortUrl');
let audienceDockEnabled = true;
let currentSlide = 0;

function presentationBasePath() {
  return location.pathname.replace(/\/play\/?$/, "").replace(/\/$/, "");
}

function audienceTargetForSlide(slide) {
  const base = `${location.origin}${presentationBasePath()}`;
  const activity = slide.dataset.audienceActivity;
  if (activity === "join" || activity === "live-dataset") return `${base}/`;
  const code = slide.dataset.audienceCode;
  return code ? `${base}/lab/?code=${encodeURIComponent(code)}` : `${base}/lab/`;
}

function shortDisplayUrl(target) {
  return target.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function updateAudienceDock(slide) {
  if (!audienceDock || !audienceToggle) return;
  const activity = slide.dataset.audienceActivity;
  const shouldShow = Boolean(activity) && audienceDockEnabled;
  audienceDock.hidden = !shouldShow;
  document.body.classList.toggle('audience-dock-visible', shouldShow);
  audienceToggle.setAttribute('aria-pressed', String(shouldShow));
  audienceToggle.textContent = shouldShow ? 'Hide audience QR' : 'Audience QR';

  if (!activity) return;
  const isJoin = activity === 'join';
  const target = audienceTargetForSlide(slide);
  audienceDockKicker.textContent = isJoin ? 'Scan once at the start' : 'Try this activity';
  audienceDockTitle.textContent = slide.dataset.audienceLabel || 'Audience activity';
  if (globalThis.OutreachQRCode) {
    audienceQrImage.src = globalThis.OutreachQRCode.svgDataUrl(target, {
      cellSize: 5,
      marginCells: 4,
      label: `QR code for ${slide.dataset.audienceLabel || 'the audience activity'}`
    });
  } else {
    audienceQrImage.src = '../assets/qr/placeholder.png';
  }
  audienceQrImage.alt = `QR code for ${slide.dataset.audienceLabel || 'the audience activity'}`;
  audienceCodeRow.hidden = isJoin || !slide.dataset.audienceCode;
  audienceCode.textContent = slide.dataset.audienceCode || '';
  const directLink = !slide.dataset.audienceCode;
  audienceDockCopy.textContent = isJoin
    ? 'Scan once to submit to the moderated live dataset. Phones are optional.'
    : directLink
      ? 'Scan to open this activity directly.'
      : 'Already in the lab? Enter this code. New arrival? Scan the QR.';
  if (audienceShortUrl) audienceShortUrl.textContent = shortDisplayUrl(target);
}

function showSlide(index) {
  const target = Math.max(0, Math.min(slides.length - 1, index));
  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === target);
    slide.classList.toggle('exit-left', i < target);
    slide.setAttribute('aria-hidden', i === target ? 'false' : 'true');
  });
  currentSlide = target;
  slideCounter.textContent = `${target + 1} / ${slides.length}`;
  progressFill.style.width = `${((target + 1) / slides.length) * 100}%`;
  prevButton.disabled = target === 0;
  nextButton.disabled = target === slides.length - 1;
  document.title = `${slides[target].dataset.title} — Training Data Lab`;
  slides[target].scrollTop = 0;
  updateAudienceDock(slides[target]);
}

prevButton.addEventListener('click', () => showSlide(currentSlide - 1));
nextButton.addEventListener('click', () => showSlide(currentSlide + 1));

document.addEventListener('keydown', event => {
  const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (editing && !['Escape'].includes(event.key)) return;
  if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
    event.preventDefault();
    showSlide(currentSlide + 1);
  }
  if (['ArrowLeft', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    showSlide(currentSlide - 1);
  }
  if (event.key === 'Home') showSlide(0);
  if (event.key === 'End') showSlide(slides.length - 1);
});

let touchStartX = null;
document.addEventListener('touchstart', event => { touchStartX = event.changedTouches[0].screenX; }, { passive: true });
document.addEventListener('touchend', event => {
  if (touchStartX === null) return;
  const delta = event.changedTouches[0].screenX - touchStartX;
  if (Math.abs(delta) > 70) showSlide(currentSlide + (delta < 0 ? 1 : -1));
  touchStartX = null;
}, { passive: true });

const notesToggle = document.getElementById('notesToggle');
notesToggle.addEventListener('click', () => {
  const on = document.body.classList.toggle('show-notes');
  notesToggle.setAttribute('aria-pressed', String(on));
});


audienceToggle?.addEventListener('click', () => {
  audienceDockEnabled = !audienceDockEnabled;
  updateAudienceDock(slides[currentSlide]);
});

document.getElementById('fullscreenButton').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    console.warn('Fullscreen is not available in this browser.', error);
  }
});

// Opening audience vote
const openingResponse = document.getElementById('openingResponse');
document.getElementById('openingChoices').addEventListener('click', event => {
  const button = event.target.closest('button[data-choice]');
  if (!button) return;
  document.querySelectorAll('#openingChoices button').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  const choice = button.dataset.choice;
  const messages = {
    time: 'Most story-heavy datasets strongly favor “time.” Your cultural prediction matches the data pattern.',
    triangle: 'A math-heavy dataset could make “triangle” the favorite. Change the examples, change the prediction.',
    sandwich: 'Unusual—but perfectly learnable if the dataset repeats “once upon a sandwich.”'
  };
  openingResponse.textContent = messages[choice];
});

// Interactive n-gram lab
const model = new NGramModel(2);
const trainingData = document.getElementById('trainingData');
const corpusPreset = document.getElementById('corpusPreset');
const predictionPrompt = document.getElementById('predictionPrompt');
const ngramOrder = document.getElementById('ngramOrder');
const temperature = document.getElementById('temperature');
const predictionBars = document.getElementById('predictionBars');
const generatedText = document.getElementById('generatedText');
const trainingStats = document.getElementById('trainingStats');

function setCorpus(name) {
  trainingData.value = CORPORA[name];
  trainAndRender();
}

function trainAndRender() {
  const order = Number(ngramOrder.value);
  model.train(trainingData.value, order);
  trainingStats.textContent = `${model.tokenCount} tokens · ${model.vocabulary.size} unique words · ${order}-word memory`;
  renderPredictions();
}

function renderPredictions() {
  const result = model.predict(predictionPrompt.value, Number(temperature.value), 7);
  predictionBars.innerHTML = '';
  if (!result.predictions.length) {
    predictionBars.innerHTML = '<p class="microcopy">No continuation found. Try a phrase that appears in the training text.</p>';
    return;
  }
  result.predictions.forEach(item => {
    const row = document.createElement('div');
    row.className = 'prediction-row';
    row.innerHTML = `
      <span class="prediction-word">${escapeHtml(item.word)}</span>
      <span class="bar-track"><span class="bar-fill" style="--width:${(item.probability * 100).toFixed(1)}%"></span></span>
      <span class="prediction-value">${(item.probability * 100).toFixed(0)}%</span>`;
    row.addEventListener('click', () => {
      predictionPrompt.value = `${predictionPrompt.value.trim()} ${item.word}`.trim();
      renderPredictions();
    });
    predictionBars.appendChild(row);
  });
  const note = document.createElement('p');
  note.className = 'microcopy';
  note.textContent = `Using the longest matching context: ${result.context}`;
  predictionBars.appendChild(note);
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

corpusPreset.addEventListener('change', () => setCorpus(corpusPreset.value));
document.getElementById('resetCorpus').addEventListener('click', () => setCorpus(corpusPreset.value));
document.getElementById('trainButton').addEventListener('click', trainAndRender);
predictionPrompt.addEventListener('input', renderPredictions);
ngramOrder.addEventListener('input', () => {
  document.getElementById('ngramValue').textContent = ngramOrder.value;
  trainAndRender();
});
temperature.addEventListener('input', () => {
  document.getElementById('temperatureValue').textContent = Number(temperature.value).toFixed(1);
  renderPredictions();
});
document.getElementById('generateButton').addEventListener('click', () => {
  generatedText.textContent = model.generate(predictionPrompt.value, 12, Number(temperature.value));
});
document.getElementById('clearGeneration').addEventListener('click', () => {
  generatedText.textContent = 'Your continuation will appear here.';
});

// Frequency experiment
const frequencyInputs = ['circle', 'triangle', 'square'].map(name => ({
  name,
  input: document.getElementById(`${name}Count`),
  output: document.getElementById(`${name}CountOutput`)
}));

function renderFrequency() {
  const values = frequencyInputs.map(item => ({ name: item.name, count: Number(item.input.value) }));
  const total = values.reduce((sum, item) => sum + item.count, 0);
  const chart = document.getElementById('frequencyChart');
  chart.innerHTML = '';
  values.forEach(item => {
    item.output.textContent = item.count;
    const probability = total ? item.count / total : 0;
    const row = document.createElement('div');
    row.className = 'big-bar';
    row.innerHTML = `<strong>${item.name}</strong><span class="big-bar-track"><span class="big-bar-fill" style="--width:${probability * 100}%"></span></span><span>${(probability * 100).toFixed(0)}%</span>`;
    chart.appendChild(row);
  });
  const leader = [...values].sort((a, b) => b.count - a.count)[0];
  document.getElementById('frequencyTakeaway').textContent = total
    ? `“${leader.name}” is favored because it appears most often after the same prompt.`
    : 'With no examples, this toy model has no evidence for any answer.';
}
frequencyInputs.forEach(item => item.input.addEventListener('input', renderFrequency));
document.getElementById('balanceButton').addEventListener('click', () => {
  frequencyInputs.forEach(item => { item.input.value = 8; });
  renderFrequency();
});

// Coverage experiment
const coverageBooks = [...document.querySelectorAll('[data-book]')];
document.getElementById('coverageTest').addEventListener('click', () => {
  const selected = new Set(coverageBooks.filter(input => input.checked).map(input => input.dataset.book));
  const result = document.getElementById('coverageResult');
  if (selected.has('topology')) {
    result.innerHTML = '<strong>Likely answer:</strong><br>A Möbius strip has one side and one boundary edge.';
  } else if (selected.has('fractal')) {
    result.innerHTML = '<strong>Weak guess:</strong><br>The shelf contains advanced shapes, but no direct Möbius-strip examples.';
  } else {
    result.innerHTML = '<strong>Out of coverage:</strong><br>The model has only seen ordinary shapes. Any confident answer would be poorly supported.';
  }
});

// Representation / association experiment
const representationSlider = document.getElementById('representationSlider');
const datasetDots = document.getElementById('datasetDots');
for (let i = 0; i < 20; i++) {
  const dot = document.createElement('span');
  dot.className = 'dataset-dot';
  datasetDots.appendChild(dot);
}

function renderRepresentation() {
  const value = Number(representationSlider.value);
  document.getElementById('representationOutput').textContent = `${value}%`;
  document.getElementById('pronounToken').textContent = value >= 50 ? 'she' : 'he';
  [...datasetDots.children].forEach((dot, index) => {
    dot.classList.toggle('alt', index < Math.round(value / 5));
  });
  const values = [
    { name: 'she', p: value / 100 },
    { name: 'he', p: 1 - value / 100 }
  ];
  const chart = document.getElementById('biasChart');
  chart.innerHTML = '';
  values.forEach(item => {
    const row = document.createElement('div');
    row.className = 'big-bar';
    row.innerHTML = `<strong>${item.name}</strong><span class="big-bar-track"><span class="big-bar-fill" style="--width:${item.p * 100}%"></span></span><span>${(item.p * 100).toFixed(0)}%</span>`;
    chart.appendChild(row);
  });
}
representationSlider.addEventListener('input', renderRepresentation);

// Word-world context experiment
const WORLDS = {
  geometry: [['parallel', 46], ['two-dimensional', 31], ['flat', 16], ['infinite', 7]],
  music: [['landing', 39], ['carrying', 28], ['delayed', 21], ['boarding', 12]],
  travel: [['boarding', 44], ['late', 27], ['to', 19], ['full', 10]]
};

function renderWorld(world) {
  const cloud = document.getElementById('worldPredictions');
  cloud.innerHTML = '';
  WORLDS[world].forEach(([word, probability]) => {
    const chip = document.createElement('span');
    chip.style.setProperty('--prob', probability);
    chip.textContent = `${word} ${probability}%`;
    cloud.appendChild(chip);
  });
}
document.querySelector('.world-switcher').addEventListener('click', event => {
  const button = event.target.closest('[data-world]');
  if (!button) return;
  document.querySelectorAll('.world').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  renderWorld(button.dataset.world);
});

// Temperature sampling experiment
const BASE_SAMPLING = [
  ['beautiful', 0.43],
  ['surprising', 0.27],
  ['playful', 0.17],
  ['useful', 0.09],
  ['purple', 0.04]
];
const samplingTemperature = document.getElementById('samplingTemperature');
function weightedSample(items, temp) {
  const weighted = items.map(([word, p]) => [word, Math.pow(p, 1 / temp)]);
  const total = weighted.reduce((sum, [, p]) => sum + p, 0);
  let cursor = Math.random() * total;
  for (const [word, p] of weighted) {
    cursor -= p;
    if (cursor <= 0) return word;
  }
  return weighted.at(-1)[0];
}
function renderSamples() {
  const container = document.getElementById('sampleResults');
  const temp = Number(samplingTemperature.value);
  container.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const chip = document.createElement('span');
    chip.className = 'sample-chip';
    chip.style.animationDelay = `${i * 35}ms`;
    chip.textContent = weightedSample(BASE_SAMPLING, temp);
    container.appendChild(chip);
  }
}
samplingTemperature.addEventListener('input', () => {
  document.getElementById('samplingTempOutput').textContent = Number(samplingTemperature.value).toFixed(1);
});
document.getElementById('resampleButton').addEventListener('click', renderSamples);

// Final quiz
const mysteryFeedback = document.getElementById('mysteryFeedback');
document.getElementById('mysteryQuiz').addEventListener('click', event => {
  const button = event.target.closest('[data-answer]');
  if (!button) return;
  document.querySelectorAll('#mysteryQuiz button').forEach(item => item.classList.remove('correct', 'incorrect'));
  const correct = button.dataset.answer === 'reviews';
  button.classList.add(correct ? 'correct' : 'incorrect');
  mysteryFeedback.textContent = correct
    ? 'Best explanation: enthusiastic reviews repeatedly pair “museum” with positive adjectives such as “magical.”'
    : 'Possible, but the probabilities fit enthusiastic visitor-review language better.';
});

// Initial state
showSlide(0);
setCorpus('story');
renderFrequency();
renderRepresentation();
renderWorld('geometry');
renderSamples();
