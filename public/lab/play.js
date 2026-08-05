"use strict";

const BASE_PATH = new URL("./", document.currentScript.src).pathname;

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

const ACCESS = {
  predictor: { code: "7316", token: "pr-6c9f3a", title: "Train a tiny model", kicker: "Activity 1", goal: "Make the model sound mathematical without changing its algorithm." },
  frequency: { code: "2049", token: "fq-92ad71", title: "Change the frequencies", kicker: "Activity 2", goal: "Move the sliders until triangle is more likely than circle." },
  coverage: { code: "5827", token: "cv-4bd8e2", title: "Change the training shelf", kicker: "Activity 3", goal: "Find the smallest shelf that supports a good Möbius-strip answer." },
  representation: { code: "4183", token: "rp-7e31c5", title: "Change representation", kicker: "Activity 4", goal: "Find the balance that makes the toy model predict both pronouns equally." },
  context: { code: "9672", token: "cx-1af684", title: "Switch training worlds", kicker: "Activity 5", goal: "Choose the training world where “plane” means a mathematical surface." },
  temperature: { code: "3506", token: "tp-83d2b9", title: "Change temperature", kicker: "Activity 6", goal: "Compare samples at the lowest and highest temperatures." },
  challenge: { code: "6241", token: "ch-5e70af", title: "Reverse-engineer the dataset", kicker: "Final challenge", goal: "Choose the training data that best explains the model’s probabilities." }
};

const waitingScreen = document.getElementById("waitingScreen");
const activityScreen = document.getElementById("activityScreen");
const codeInput = document.getElementById("activityCode");
const codeFeedback = document.getElementById("codeFeedback");
const activityMount = document.getElementById("activityMount");
const activityTitle = document.getElementById("activityTitle");
const activityKicker = document.getElementById("activityKicker");
const activityGoal = document.getElementById("activityGoal");

class NGramModel {
  constructor(order = 2) {
    this.order = order;
    this.tables = new Map();
    this.tokenCount = 0;
    this.vocabulary = new Set();
  }

  static tokenize(text) {
    return text.toLowerCase().replace(/[“”]/g, '"').replace(/[’]/g, "'").match(/[a-z0-9']+|[.!?,;:]/g) || [];
  }

  train(text, order = this.order) {
    this.order = order;
    this.tables.clear();
    this.vocabulary.clear();
    this.tokenCount = 0;
    const sequences = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
    for (const sequence of sequences) {
      const words = NGramModel.tokenize(sequence);
      this.tokenCount += words.length;
      words.forEach(word => this.vocabulary.add(word));
      const padded = Array(order).fill("<s>").concat(words, ["</s>"]);
      for (let i = order; i < padded.length; i++) {
        for (let size = 0; size <= order; size++) {
          const context = padded.slice(i - size, i).join(" ");
          if (!this.tables.has(context)) this.tables.set(context, new Map());
          const counts = this.tables.get(context);
          counts.set(padded[i], (counts.get(padded[i]) || 0) + 1);
        }
      }
    }
    return this;
  }

  getCounts(prompt) {
    const tokens = NGramModel.tokenize(prompt);
    for (let size = Math.min(this.order, tokens.length); size >= 0; size--) {
      const context = tokens.slice(-size).join(" ");
      const counts = this.tables.get(context);
      if (counts?.size) return { counts, context: context || "any context" };
    }
    return { counts: new Map(), context: "no match" };
  }

  predict(prompt, temperature = 1, limit = 7) {
    const { counts, context } = this.getCounts(prompt);
    const weighted = [...counts.entries()]
      .filter(([word]) => word !== "</s>")
      .map(([word, count]) => ({ word, weight: Math.pow(count, 1 / Math.max(.05, temperature)) }));
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    return {
      context,
      predictions: weighted.map(item => ({ word: item.word, probability: total ? item.weight / total : 0 }))
        .sort((a, b) => b.probability - a.probability).slice(0, limit)
    };
  }

  sample(prompt, temperature = 1) {
    const { counts } = this.getCounts(prompt);
    const weighted = [...counts.entries()].map(([word, count]) => [word, Math.pow(count, 1 / Math.max(.05, temperature))]);
    const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = Math.random() * total;
    for (const [word, weight] of weighted) {
      cursor -= weight;
      if (cursor <= 0) return word;
    }
    return weighted.at(-1)?.[0] || null;
  }

  generate(prompt, count, temperature) {
    const words = NGramModel.tokenize(prompt);
    for (let i = 0; i < count; i++) {
      const next = this.sample(words.join(" "), temperature);
      if (!next || next === "</s>") break;
      words.push(next);
    }
    return words.join(" ");
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function routeFor(name) {
  const item = ACCESS[name];
  return `${BASE_PATH}?a=${encodeURIComponent(name)}&k=${encodeURIComponent(item.token)}`;
}

function showWaiting(message = "") {
  waitingScreen.hidden = false;
  activityScreen.hidden = true;
  activityMount.innerHTML = "";
  codeInput.value = "";
  codeFeedback.textContent = message;
  codeFeedback.className = "feedback";
  document.title = "Audience Lab · Training Data";
  history.replaceState({}, "", BASE_PATH);
  window.setTimeout(() => codeInput.focus(), 50);
}

function openActivity(name, updateUrl = true) {
  const item = ACCESS[name];
  if (!item) return showWaiting("That activity is not available.");
  waitingScreen.hidden = true;
  activityScreen.hidden = false;
  activityKicker.textContent = item.kicker;
  activityTitle.textContent = item.title;
  activityGoal.textContent = item.goal;
  activityMount.innerHTML = "";
  document.title = `${item.title} · Audience Lab`;
  if (updateUrl) history.replaceState({}, "", routeFor(name));
  renderers[name](activityMount);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function unlockFromCode() {
  const code = codeInput.value.replace(/\D/g, "");
  const match = Object.entries(ACCESS).find(([, item]) => item.code === code);
  if (!match) {
    codeFeedback.textContent = code.length < 4 ? "Enter the four digits shown by the presenter." : "That code is not active. Check the main screen and try again.";
    codeFeedback.className = "feedback error";
    return;
  }
  openActivity(match[0]);
}

document.getElementById("unlockButton").addEventListener("click", unlockFromCode);
codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 4);
  codeFeedback.textContent = "";
  codeFeedback.className = "feedback";
});
codeInput.addEventListener("keydown", event => { if (event.key === "Enter") unlockFromCode(); });
document.getElementById("leaveActivity").addEventListener("click", () => showWaiting());
document.getElementById("finishedButton").addEventListener("click", () => showWaiting("Ready for the next code."));

function predictionRows(items) {
  if (!items.length) return '<p class="helper">No matching continuation. Try a prompt that appears in the training text.</p>';
  return `<div class="prediction-list">${items.map(item => `<div class="prediction-row"><strong>${escapeHtml(item.word)}</strong><span class="track"><span class="fill" style="--width:${(item.probability * 100).toFixed(1)}%"></span></span><span>${(item.probability * 100).toFixed(0)}%</span></div>`).join("")}</div>`;
}

function barRows(items) {
  return `<div class="big-bars">${items.map(item => `<div class="big-bar"><strong>${escapeHtml(item.name)}</strong><span class="track"><span class="fill" style="--width:${item.p * 100}%"></span></span><span>${(item.p * 100).toFixed(0)}%</span></div>`).join("")}</div>`;
}

function renderPredictor(mount) {
  mount.innerHTML = `<div class="lab-stack">
    <section class="lab-card lab-stack">
      <div class="field"><label for="pPreset">Training-data recipe</label><select id="pPreset"><option value="story">Story world</option><option value="math">Math world</option><option value="space">Space world</option><option value="mixed">Balanced mixture</option></select></div>
      <div class="field"><label for="pData">Training examples</label><textarea id="pData" spellcheck="false"></textarea></div>
      <div class="button-row"><button id="pTrain" class="primary" type="button">Train model</button><button id="pReset" class="secondary" type="button">Reset examples</button></div>
      <p id="pStats" class="helper" aria-live="polite"></p>
    </section>
    <section class="lab-card lab-stack">
      <div class="field"><label for="pPrompt">Prompt</label><input id="pPrompt" value="once upon a" autocomplete="off" /></div>
      <div class="range-field"><label for="pMemory">Memory <output id="pMemoryOut">2 words</output></label><input id="pMemory" type="range" min="1" max="4" value="2" /></div>
      <div class="range-field"><label for="pTemp">Temperature <output id="pTempOut">0.8</output></label><input id="pTemp" type="range" min="0.2" max="2" step="0.1" value="0.8" /></div>
      <div><h2>Next-word probabilities</h2><div id="pPredictions" aria-live="polite"></div></div>
      <button id="pGenerate" class="primary" type="button">Generate 12 words</button>
      <div id="pGenerated" class="generated">Your continuation will appear here.</div>
    </section>
  </div>`;
  const model = new NGramModel();
  const preset = mount.querySelector("#pPreset");
  const data = mount.querySelector("#pData");
  const prompt = mount.querySelector("#pPrompt");
  const memory = mount.querySelector("#pMemory");
  const temp = mount.querySelector("#pTemp");
  const predictions = mount.querySelector("#pPredictions");
  const stats = mount.querySelector("#pStats");
  const generated = mount.querySelector("#pGenerated");

  function render() {
    const result = model.predict(prompt.value, Number(temp.value));
    predictions.innerHTML = predictionRows(result.predictions) + `<p class="helper">Longest matching context: ${escapeHtml(result.context)}</p>`;
  }
  function train() {
    model.train(data.value, Number(memory.value));
    stats.textContent = `${model.tokenCount} tokens · ${model.vocabulary.size} unique words · memory ${memory.value}`;
    render();
  }
  function setPreset() { data.value = CORPORA[preset.value]; train(); }

  preset.addEventListener("change", setPreset);
  mount.querySelector("#pTrain").addEventListener("click", train);
  mount.querySelector("#pReset").addEventListener("click", setPreset);
  prompt.addEventListener("input", render);
  memory.addEventListener("input", () => { mount.querySelector("#pMemoryOut").textContent = `${memory.value} word${memory.value === "1" ? "" : "s"}`; train(); });
  temp.addEventListener("input", () => { mount.querySelector("#pTempOut").textContent = Number(temp.value).toFixed(1); render(); });
  mount.querySelector("#pGenerate").addEventListener("click", () => { generated.textContent = model.generate(prompt.value, 12, Number(temp.value)); });
  setPreset();
}

function renderFrequency(mount) {
  mount.innerHTML = `<section class="lab-card lab-stack">
    <div class="prompt-box"><p class="prompt">After “the shape is”...</p></div>
    ${["circle", "triangle", "square"].map((name, i) => `<div class="range-field"><label for="f-${name}">${name} examples <output id="f-${name}-out">${[8,4,2][i]}</output></label><input id="f-${name}" type="range" min="0" max="20" value="${[8,4,2][i]}" /></div>`).join("")}
    <button id="fBalance" class="secondary" type="button">Balance the dataset</button>
    <div id="fChart" aria-live="polite"></div>
    <p id="fTakeaway" class="helper"></p>
  </section>`;
  const names = ["circle", "triangle", "square"];
  function render() {
    const values = names.map(name => ({ name, count: Number(mount.querySelector(`#f-${name}`).value) }));
    values.forEach(item => { mount.querySelector(`#f-${item.name}-out`).textContent = item.count; });
    const total = values.reduce((sum, item) => sum + item.count, 0);
    mount.querySelector("#fChart").innerHTML = barRows(values.map(item => ({ name: item.name, p: total ? item.count / total : 0 })));
    const leader = [...values].sort((a, b) => b.count - a.count)[0];
    mount.querySelector("#fTakeaway").textContent = total ? `${leader.name} is favored because it appears most often after the same prompt.` : "With no examples, the model has no evidence for an answer.";
  }
  names.forEach(name => mount.querySelector(`#f-${name}`).addEventListener("input", render));
  mount.querySelector("#fBalance").addEventListener("click", () => { names.forEach(name => { mount.querySelector(`#f-${name}`).value = 8; }); render(); });
  render();
}

function renderCoverage(mount) {
  mount.innerHTML = `<section class="lab-card lab-stack">
    <div class="prompt-box"><p class="prompt">Prompt: “A Möbius strip has...”</p></div>
    <div class="check-list">
      <label class="check-row"><input type="checkbox" data-book="circle" checked /> Books about circles</label>
      <label class="check-row"><input type="checkbox" data-book="triangle" checked /> Books about triangles</label>
      <label class="check-row"><input type="checkbox" data-book="fractal" /> Books about fractals</label>
      <label class="check-row"><input type="checkbox" data-book="topology" /> Books about topology</label>
    </div>
    <button id="cAsk" class="primary" type="button">Ask the model</button>
    <div id="cResult" class="result-card dark" aria-live="polite">Choose the shelf, then test it.</div>
  </section>`;
  mount.querySelector("#cAsk").addEventListener("click", () => {
    const selected = new Set([...mount.querySelectorAll("[data-book]:checked")].map(input => input.dataset.book));
    const result = mount.querySelector("#cResult");
    if (selected.has("topology")) result.innerHTML = "<strong>Supported answer</strong><br>A Möbius strip has one side and one boundary edge.";
    else if (selected.has("fractal")) result.innerHTML = "<strong>Weak guess</strong><br>The shelf contains advanced shapes, but no direct Möbius-strip examples.";
    else result.innerHTML = "<strong>Out of coverage</strong><br>The model has only seen ordinary shapes. A confident answer would be poorly supported.";
  });
}

function renderRepresentation(mount) {
  mount.innerHTML = `<section class="lab-card lab-stack">
    <div class="prompt-box"><p class="prompt">“The scientist said ___ discovered a pattern.”</p></div>
    <div class="range-field"><label for="rShare">Share using “she” <output id="rOut">20%</output></label><input id="rShare" type="range" min="0" max="100" value="20" /></div>
    <div id="rDots" class="dot-grid" aria-label="Twenty toy training examples"></div>
    <div id="rChart" aria-live="polite"></div>
    <p class="helper">This toy model reflects repeated sentence patterns. It is not discovering who scientists are.</p>
  </section>`;
  const slider = mount.querySelector("#rShare");
  const dots = mount.querySelector("#rDots");
  for (let i = 0; i < 20; i++) dots.appendChild(document.createElement("span")).className = "dot";
  function render() {
    const value = Number(slider.value);
    mount.querySelector("#rOut").textContent = `${value}%`;
    [...dots.children].forEach((dot, index) => dot.classList.toggle("alt", index < Math.round(value / 5)));
    mount.querySelector("#rChart").innerHTML = barRows([{ name: "she", p: value / 100 }, { name: "he", p: 1 - value / 100 }]);
  }
  slider.addEventListener("input", render);
  render();
}

function renderContext(mount) {
  const worlds = {
    geometry: [["parallel", 46], ["two-dimensional", 31], ["flat", 16], ["infinite", 7]],
    music: [["landing", 39], ["carrying", 28], ["delayed", 21], ["boarding", 12]],
    travel: [["boarding", 44], ["late", 27], ["to", 19], ["full", 10]]
  };
  mount.innerHTML = `<section class="lab-card lab-stack">
    <div class="prompt-box"><p class="prompt">The next <strong>plane</strong> is...</p></div>
    <div class="world-list"><button class="world-button active" data-world="geometry" type="button">Geometry</button><button class="world-button" data-world="music" type="button">Music</button><button class="world-button" data-world="travel" type="button">Travel</button></div>
    <div id="xCloud" class="result-card" aria-live="polite"></div>
    <p class="helper">The word stayed the same. The training distribution changed its likely continuation.</p>
  </section>`;
  function render(world) {
    mount.querySelector("#xCloud").innerHTML = `<div class="chip-cloud">${worlds[world].map(([word, p]) => `<span class="chip">${escapeHtml(word)} ${p}%</span>`).join("")}</div>`;
  }
  mount.querySelector(".world-list").addEventListener("click", event => {
    const button = event.target.closest("[data-world]");
    if (!button) return;
    mount.querySelectorAll("[data-world]").forEach(item => item.classList.toggle("active", item === button));
    render(button.dataset.world);
  });
  render("geometry");
}

function renderTemperature(mount) {
  const base = [["beautiful", .43], ["surprising", .27], ["playful", .17], ["useful", .09], ["purple", .04]];
  mount.innerHTML = `<section class="lab-card lab-stack">
    <div class="prompt-box"><p class="prompt">After “math can be”...</p></div>
    <div class="range-field"><label for="tTemp">Temperature <output id="tOut">0.7</output></label><input id="tTemp" type="range" min="0.1" max="2" value="0.7" step="0.1" /></div>
    <button id="tSample" class="primary" type="button">Sample 8 times</button>
    <div id="tResults" class="sample-grid" aria-live="polite"></div>
    <p class="helper">Low temperature repeats likely words. High temperature increases variety; it does not add knowledge.</p>
  </section>`;
  const slider = mount.querySelector("#tTemp");
  function sample(temp) {
    const weighted = base.map(([word, p]) => [word, Math.pow(p, 1 / temp)]);
    const total = weighted.reduce((sum, [, p]) => sum + p, 0);
    let cursor = Math.random() * total;
    for (const [word, p] of weighted) { cursor -= p; if (cursor <= 0) return word; }
    return weighted.at(-1)[0];
  }
  function render() {
    const temp = Number(slider.value);
    mount.querySelector("#tResults").innerHTML = Array.from({ length: 8 }, () => `<span class="sample-chip">${sample(temp)}</span>`).join("");
  }
  slider.addEventListener("input", () => { mount.querySelector("#tOut").textContent = Number(slider.value).toFixed(1); });
  mount.querySelector("#tSample").addEventListener("click", render);
  render();
}

function renderChallenge(mount) {
  mount.innerHTML = `<section class="lab-card lab-stack">
    <div class="prompt-box"><p class="prompt">The museum is...</p></div>
    ${barRows([{ name: "magical", p: .72 }, { name: "quiet", p: .17 }, { name: "open", p: .08 }, { name: "square", p: .03 }])}
    <h2>Which training set best explains this?</h2>
    <div class="choice-list" id="qChoices"><button class="choice-button" data-answer="hours" type="button">Visitor-hours listings</button><button class="choice-button" data-answer="reviews" type="button">Enthusiastic visitor reviews</button><button class="choice-button" data-answer="geometry" type="button">Geometry textbooks</button></div>
    <div id="qFeedback" class="result-card" aria-live="polite">Choose the evidence that best explains the probabilities.</div>
  </section>`;
  mount.querySelector("#qChoices").addEventListener("click", event => {
    const button = event.target.closest("[data-answer]");
    if (!button) return;
    mount.querySelectorAll("[data-answer]").forEach(item => item.classList.remove("correct", "incorrect"));
    const correct = button.dataset.answer === "reviews";
    button.classList.add(correct ? "correct" : "incorrect");
    mount.querySelector("#qFeedback").textContent = correct ? "Best explanation: enthusiastic reviews repeatedly pair “museum” with positive adjectives such as “magical.”" : "Possible, but the probability pattern fits enthusiastic review language better.";
  });
}

const renderers = {
  predictor: renderPredictor,
  frequency: renderFrequency,
  coverage: renderCoverage,
  representation: renderRepresentation,
  context: renderContext,
  temperature: renderTemperature,
  challenge: renderChallenge
};

function startFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("a");
  const token = params.get("k");
  if (name && ACCESS[name]?.token === token) openActivity(name, false);
  else showWaiting(name || token ? "That activity link is not valid. Use the code on the main screen." : "");
}

window.addEventListener("popstate", startFromUrl);
startFromUrl();
