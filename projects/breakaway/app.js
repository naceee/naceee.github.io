const DATA_URL = "data/riders-2026.json?v=pro-pools-1";
const DATA_SEASON = 2026;
const MAX_ROUNDS = 10;
const MIN_POOL_HINTS = MAX_ROUNDS * 2;
const MAX_POOL_HINTS = MAX_ROUNDS * 3;

// Base draw weights: difficult evidence is common, while identity giveaways are rare.
// Later rounds progressively boost low-difficulty hints, so the game still gets easier.
const DRAW_PROFILES = Object.freeze({
  specialty: { weight: 10, difficulty: 5 },
  ranking: { weight: 8, difficulty: 4.5 },
  stat: { weight: 7, difficulty: 4 },
  badge: { weight: 6, difficulty: 3.5 },
  result: { weight: 6, difficulty: 3 },
  personal: { weight: 3, difficulty: 2.5 },
  team: { weight: 2, difficulty: 2 },
  identity: { weight: 0.55, difficulty: 1 },
  name: { weight: 1, difficulty: 1.5 },
});

const state = {
  riders: [],
  answer: null,
  hints: [],
  hintRounds: [],
  round: 0,
  guesses: [],
  selectedSlug: null,
  activeSuggestion: -1,
  filteredSuggestions: [],
  finished: false,
  poolMode: "wt",
};

const el = {
  panel: document.querySelector("#game-panel"),
  clueNumber: document.querySelector("#clue-number"),
  progress: document.querySelector("#progress-track"),
  form: document.querySelector("#guess-form"),
  input: document.querySelector("#guess-input"),
  guessButton: document.querySelector("#guess-button"),
  suggestions: document.querySelector("#suggestions"),
  feedback: document.querySelector("#guess-feedback"),
  skipButton: document.querySelector("#skip-button"),
  revealButton: document.querySelector("#reveal-button"),
  evidence: document.querySelector("#evidence-grid"),
  empty: document.querySelector("#empty-state"),
  resultDialog: document.querySelector("#result-dialog"),
  dialogKicker: document.querySelector("#dialog-kicker"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogMessage: document.querySelector("#dialog-message"),
  resultName: document.querySelector("#result-name"),
  resultMeta: document.querySelector("#result-meta"),
  resultAttempts: document.querySelector("#result-attempts"),
  pcsLink: document.querySelector("#pcs-link"),
  statsDialog: document.querySelector("#stats-dialog"),
  poolPicker: document.querySelector("#pool-picker"),
};

const normalize = (value) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/gi, " ")
  .trim()
  .toLowerCase();

const getStat = (rider, label) => rider.keyStats?.find((item) => item.label === label);

function makeHint(category, type, title, value, detail = "", draw = {}) {
  const profile = DRAW_PROFILES[type] || DRAW_PROFILES.personal;
  return {
    id: crypto.randomUUID(),
    category,
    type,
    title,
    value,
    detail,
    weight: draw.weight ?? profile.weight,
    difficulty: draw.difficulty ?? profile.difficulty,
  };
}

function buildHintPool(rider) {
  const early = [];
  const middle = [];
  const late = [];
  const personal = [];

  for (const specialty of rider.specialties || []) {
    early.push(makeHint("Rider DNA", "specialty", specialty.label, specialty.value, "career specialty score"));
  }

  // An unfinished season's position and points change after virtually every race.
  // Only completed seasons belong in the ranking chart.
  const seasonRanks = [...(rider.rankings || [])]
    .filter((rank) => rank.season < DATA_SEASON)
    .sort((a, b) => a.season - b.season);
  const rankBatchSize = seasonRanks.length > 8 ? 3 : Math.max(2, Math.ceil(seasonRanks.length / 2));
  for (let index = 0; index < seasonRanks.length; index += rankBatchSize) {
    const batch = seasonRanks.slice(index, index + rankBatchSize);
    if (!batch.length) continue;
    const span = batch.length === 1 ? `${batch[0].season} season` : `${batch[0].season}–${batch.at(-1).season} seasons`;
    middle.push(makeHint("Season rankings", "ranking", span, batch, `${batch.length} seasons revealed together`));
  }

  for (const label of ["Classics", "Grand tours", "Wins"]) {
    const stat = getStat(rider, label);
    if (!stat) continue;
    middle.push(makeHint("Career ledger", "stat", label, stat.value, stat.details?.join(" · ") || "career total"));
  }

  for (const badge of (rider.badges || []).slice().reverse().slice(0, 3)) {
    middle.push(makeHint("Badges", "badge", badge, "Earned", "PCS profile badge"));
  }

  const results = [...(rider.topResults || [])].reverse();
  for (const result of results.slice(0, 10)) {
    const placing = result.result || "Win";
    const numericPlacing = Number.parseInt(result.result, 10) || 1;
    late.push(makeHint(
      "Selected results",
      "result",
      result.race,
      `${placing}${result.kind ? ` · ${result.kind}` : ""}`,
      "",
      {
        weight: numericPlacing <= 1 ? 3.5 : numericPlacing <= 3 ? 4.5 : 6.5,
        difficulty: numericPlacing <= 1 ? 2 : numericPlacing <= 3 ? 2.5 : 3.5,
      },
    ));
  }

  if (rider.height) personal.push(makeHint("Personal file", "personal", "Height", `${rider.height.toFixed(2)} m`, "profile measurement"));
  personal.push(makeHint("Personal file", "personal", "Age this season", rider.age, "age on the team roster"));
  if (rider.birthYear) personal.push(makeHint("Personal file", "personal", "Year of birth", rider.birthYear, rider.dateOfBirth || ""));

  const oldTeams = (rider.teamHistory || [])
    .filter((team) => team.season < 2025 && normalize(team.name) !== normalize(rider.team))
    .sort((a, b) => a.season - b.season);
  for (const oldTeam of oldTeams.slice(0, 3)) {
    personal.push(makeHint("Team trail", "team", `${oldTeam.season} team`, oldTeam.name, oldTeam.level || "former team"));
  }
  if (rider.birthPlace) personal.push(makeHint("Personal file", "personal", "Place of birth", rider.birthPlace));

  const identityHints = [
    makeHint("Personal file", "identity", "Nationality", rider.nationality || rider.countryCode.toUpperCase(), "low-probability identity clue"),
    makeHint("Team trail", "identity", "Current team", rider.currentTeam || rider.team, "2026 WorldTour roster"),
  ];
  const pool = [...early, ...middle, ...late, ...personal, ...identityHints];
  const lettersOnly = rider.name.replace(/[^\p{L}]/gu, "");
  const nameParts = rider.name.trim().split(/\s+/);
  const firstName = nameParts[0] || rider.name;
  const surname = nameParts.at(-1) || rider.name;
  const vowelCount = (rider.name.normalize("NFD").match(/[aeiouy]/giu) || []).length;
  const consonantCount = [...lettersOnly].length - vowelCount;
  const hasDiacritics = rider.name.normalize("NFD") !== rider.name;
  const pastTeams = (rider.teamHistory || []).filter((team) => team.season < DATA_SEASON);
  const pastResults = (rider.topResults || []).filter((result) => result.year && result.year < DATA_SEASON);
  const fallbackFacts = [
    makeHint("Personal file", "name", "Letters in full name", [...lettersOnly].length, "spaces and punctuation excluded"),
    makeHint("Personal file", "name", "Words in full name", nameParts.length, "profile display name"),
    makeHint("Personal file", "name", "Letters in surname", [...surname].length, "punctuation excluded"),
    makeHint("Personal file", "name", "Letters in first name", [...firstName].length, "punctuation excluded"),
    makeHint("Personal file", "name", "Vowels in full name", vowelCount, "accented vowels included"),
    makeHint("Personal file", "name", "Consonants in full name", consonantCount, "spaces and punctuation excluded"),
    makeHint("Personal file", "name", "Name uses diacritics", hasDiacritics ? "Yes" : "No", "profile display name"),
    makeHint("Career ledger", "stat", "Completed seasons with a PCS rank", seasonRanks.length, `through ${DATA_SEASON - 1}`),
    makeHint("Team trail", "team", "Teams listed before this season", pastTeams.length, `profile history through ${DATA_SEASON - 1}`),
    makeHint("Personal file", "name", "Top results listed before this season", pastResults.length, `profile list through ${DATA_SEASON - 1}`),
  ];
  while (pool.length < MIN_POOL_HINTS && fallbackFacts.length) pool.push(fallbackFacts.shift());
  return pool;
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
}

function weightedChoice(candidates, roundNumber) {
  const progress = (roundNumber - 1) / Math.max(1, MAX_ROUNDS - 1);
  const weighted = candidates.map((hint) => {
    const easyBoost = 1 + (progress ** 2) * Math.max(0, 5.5 - hint.difficulty) * 7;
    return { hint, weight: hint.weight * easyBoost };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.hint;
  }
  return weighted.at(-1).hint;
}

function buildHintRounds(pool) {
  const remaining = [...pool];
  const usableHintCount = Math.min(remaining.length, MAX_POOL_HINTS);
  const threeHintRounds = Math.max(0, usableHintCount - MIN_POOL_HINTS);
  const batchSizes = shuffled([
    ...Array(threeHintRounds).fill(3),
    ...Array(MAX_ROUNDS - threeHintRounds).fill(2),
  ]);
  return batchSizes.map((batchSize, roundIndex) => {
    const picked = [];
    while (picked.length < batchSize && remaining.length) {
      const usedCategories = new Set(picked.map((hint) => hint.category));
      const diverseCandidates = remaining.filter((hint) => !usedCategories.has(hint.category));
      const candidates = diverseCandidates.length ? diverseCandidates : remaining;
      const hint = weightedChoice(candidates, roundIndex + 1);
      remaining.splice(remaining.indexOf(hint), 1);
      picked.push({ ...hint, round: roundIndex + 1 });
    }
    return picked;
  });
}

function pickRider() {
  const recent = JSON.parse(localStorage.getItem("breakaway-recent") || "[]");
  const eligible = getEligibleRiders();
  const candidates = eligible.filter((rider) => !recent.includes(rider.slug));
  const pool = candidates.length ? candidates : eligible;
  const rider = pool[Math.floor(Math.random() * pool.length)];
  localStorage.setItem("breakaway-recent", JSON.stringify([rider.slug, ...recent].slice(0, 30)));
  return rider;
}

function getEligibleRiders() {
  let eligible = state.riders;
  if (state.poolMode === "top") eligible = state.riders.filter((rider) => rider.topRank);
  if (state.poolMode === "wt") eligible = state.riders.filter((rider) => rider.level === "WT");
  return eligible.length ? eligible : state.riders;
}

function renderPoolPicker() {
  const counts = {
    top: state.riders.filter((rider) => rider.topRank).length,
    wt: state.riders.filter((rider) => rider.level === "WT").length,
    pro: state.riders.length,
  };
  document.querySelector("#top-pool-count").textContent = counts.top;
  document.querySelector("#wt-pool-count").textContent = counts.wt;
  document.querySelector("#pro-pool-count").textContent = counts.pro;
  el.poolPicker.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.pool === state.poolMode));
  });
}

function startRound() {
  renderPoolPicker();
  state.answer = pickRider();
  state.hintRounds = buildHintRounds(buildHintPool(state.answer));
  state.hints = state.hintRounds.flat();
  state.round = 1;
  state.guesses = [];
  state.selectedSlug = null;
  state.finished = false;
  el.feedback.textContent = "";
  el.feedback.className = "guess-feedback";
  el.input.value = "";
  el.input.disabled = false;
  el.guessButton.disabled = true;
  el.skipButton.disabled = false;
  el.revealButton.disabled = false;
  el.evidence.innerHTML = "";
  renderProgress();
  renderEvidence();
  el.input.focus({ preventScroll: true });
  el.panel.setAttribute("aria-busy", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProgress() {
  el.progress.innerHTML = state.hintRounds.map((_, index) => {
    const attempted = state.guesses.some((guess) => guess.round === index + 1);
    const status = attempted ? "is-guessed" : index < state.round ? "is-open" : "";
    return `<span class="progress-segment ${status}" title="Round ${index + 1}"></span>`;
  }).join("");
  el.clueNumber.textContent = String(state.round).padStart(2, "0");
}

function advanceRound() {
  if (state.finished) return;
  if (state.round >= state.hintRounds.length) {
    finishRound(false, true);
    return;
  }
  state.round += 1;
  renderProgress();
  renderEvidence();
  el.input.disabled = false;
  el.input.focus({ preventScroll: true });
}

const categoryMeta = {
  "Rider DNA": ["RIDER DNA / SPECIALTIES", "is-wide"],
  "Season rankings": ["PCS RANKING BY SEASON", "is-wide"],
  "Career ledger": ["CAREER LEDGER", ""],
  "Badges": ["BADGES", ""],
  "Selected results": ["SELECTED RESULTS", "is-wide"],
  "Personal file": ["PERSONAL FILE", ""],
  "Team trail": ["TEAM TRAIL", ""],
};

function renderEvidence() {
  const visible = state.hintRounds.slice(0, state.round).flat();
  const groups = Object.groupBy
    ? Object.groupBy(visible, (hint) => hint.category)
    : visible.reduce((all, hint) => ((all[hint.category] ||= []).push(hint), all), {});

  el.evidence.innerHTML = Object.entries(groups).map(([category, hints]) => renderCard(category, hints)).join("");
}

function renderCard(category, hints) {
  const [label, className] = categoryMeta[category] || [category.toUpperCase(), ""];
  const latestRound = Math.max(...hints.map((hint) => hint.round));
  return `
    <article class="evidence-card ${className}">
      <div class="card-header"><h3>${escapeHtml(label)}</h3><span>UPDATED R${String(latestRound).padStart(2, "0")}</span></div>
      ${renderCardBody(category, hints)}
    </article>`;
}

function renderCardBody(category, hints) {
  if (category === "Rider DNA") {
    const max = Math.max(...state.answer.specialties.map((item) => item.value), 1);
    return `<div class="bar-list">${hints.map((hint) => `
      <div class="bar-item"><span>${escapeHtml(hint.title)}</span><div class="bar-track"><div class="bar-fill" style="--width:${Math.max(2, (Number(hint.value) / max) * 100)}%"></div></div><strong>${hint.value}</strong></div>
    `).join("")}</div>`;
  }
  if (category === "Season rankings") {
    const ranks = hints.flatMap((hint) => Array.isArray(hint.value) ? hint.value : [hint.value]).filter((value) => value && typeof value === "object");
    const maxPoints = Math.max(...ranks.map((rank) => rank.points), 1);
    return `<div class="ranking-list">${ranks.map((rank) => `
      <div class="ranking-column"><strong>#${rank.rank ?? "—"}</strong><div class="ranking-bar" style="--height:${Math.max(5, (rank.points / maxPoints) * 105)}px"></div><span>${rank.season}</span></div>
    `).join("")}</div>`;
  }
  if (category === "Selected results") {
    return `<div>${hints.map((hint) => `<span class="result-chip"><b>${escapeHtml(String(hint.value))}</b>${escapeHtml(hint.title)}${hint.detail ? ` · ${escapeHtml(hint.detail)}` : ""}</span>`).join("")}</div>`;
  }
  if (category === "Badges") {
    return `<div>${hints.map((hint) => `<span class="badge-chip">◆ ${escapeHtml(hint.title)}</span>`).join("")}</div>`;
  }
  return `<ul class="clue-list">${hints.map((hint) => {
    return `<li class="clue-row"><span class="clue-index">R${hint.round}</span><div><strong>${escapeHtml(hint.title)} — ${escapeHtml(String(hint.value))}</strong>${hint.detail ? `<p>${escapeHtml(hint.detail)}</p>` : ""}</div></li>`;
  }).join("")}</ul>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function filterRiders(query) {
  const search = normalize(query);
  if (!search) return [];
  return getEligibleRiders()
    .filter((rider) => normalize(rider.name).includes(search))
    .sort((a, b) => {
      const aStarts = normalize(a.name).startsWith(search) ? 0 : 1;
      const bStarts = normalize(b.name).startsWith(search) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, 8);
}

function renderSuggestions() {
  const query = el.input.value;
  state.filteredSuggestions = filterRiders(query);
  state.activeSuggestion = -1;
  state.selectedSlug = null;
  el.guessButton.disabled = !query.trim();
  if (!query.trim()) return closeSuggestions();

  el.suggestions.hidden = false;
  el.input.setAttribute("aria-expanded", "true");
  el.suggestions.innerHTML = state.filteredSuggestions.length
    ? state.filteredSuggestions.map((rider, index) => `
      <button class="suggestion" type="button" role="option" data-index="${index}" data-slug="${rider.slug}">
        <strong>${escapeHtml(rider.name)}</strong><span>${escapeHtml(rider.team)}</span>
      </button>`).join("")
    : '<div class="suggestion-empty">No current WorldTour rider found.</div>';
}

function closeSuggestions() {
  el.suggestions.hidden = true;
  el.suggestions.innerHTML = "";
  el.input.setAttribute("aria-expanded", "false");
  state.activeSuggestion = -1;
}

function chooseSuggestion(index) {
  const rider = state.filteredSuggestions[index];
  if (!rider) return;
  state.selectedSlug = rider.slug;
  el.input.value = rider.name;
  el.guessButton.disabled = false;
  closeSuggestions();
}

function resolveGuess() {
  if (state.selectedSlug) return state.riders.find((rider) => rider.slug === state.selectedSlug);
  const inputName = normalize(el.input.value);
  return state.riders.find((rider) => normalize(rider.name) === inputName) || null;
}

function submitGuess(event) {
  event.preventDefault();
  if (state.finished || el.input.disabled) return;
  const guessedRider = resolveGuess();
  if (!guessedRider) {
    el.feedback.className = "guess-feedback is-wrong";
    el.feedback.textContent = "Choose a current WorldTour rider from the list.";
    return;
  }
  if (state.guesses.some((guess) => guess.slug === guessedRider.slug)) {
    el.feedback.className = "guess-feedback is-wrong";
    el.feedback.textContent = "You already tried that rider—pick someone else.";
    return;
  }

  state.guesses.push({ slug: guessedRider.slug, round: state.round });
  el.input.value = "";
  el.guessButton.disabled = true;
  state.selectedSlug = null;
  closeSuggestions();
  if (guessedRider.slug === state.answer.slug) {
    finishRound(true, false);
    return;
  }

  const nextRound = state.round + 1;
  const newHints = state.hintRounds[state.round]?.length || 0;
  el.feedback.className = "guess-feedback is-wrong";
  el.feedback.textContent = `Not ${guessedRider.name}. Round ${nextRound} adds ${newHints} new clues.`;
  advanceRound();
}

function skipGuess() {
  if (state.finished) return;
  state.guesses.push({ slug: null, round: state.round });
  const nextRound = state.round + 1;
  const newHints = state.hintRounds[state.round]?.length || 0;
  el.feedback.className = "guess-feedback is-new";
  el.feedback.textContent = `Round ${nextRound} is open with ${newHints} new clues.`;
  advanceRound();
}

function finishRound(won, exhausted = false) {
  if (state.finished) return;
  state.finished = true;
  el.input.disabled = true;
  el.guessButton.disabled = true;
  el.skipButton.disabled = true;
  el.revealButton.disabled = true;
  updateStats(won);

  el.dialogKicker.textContent = won ? "RIDER FOUND" : "RIDER REVEALED";
  el.dialogTitle.textContent = won ? "You bridged across." : exhausted ? "End of the clue road." : "Mystery solved.";
  el.resultName.textContent = state.answer.name;
  el.resultMeta.textContent = `${state.answer.nationality || ""} · ${state.answer.currentTeam || state.answer.team}`;
  el.resultAttempts.textContent = String(Math.max(1, state.round)).padStart(2, "0");
  el.dialogMessage.textContent = won
    ? `Solved in round ${state.round}. That is seriously sharp.`
    : `You reached round ${state.round} of ${state.hintRounds.length}. The peloton gets another chance.`;
  el.pcsLink.href = state.answer.sourceUrl;
  el.resultDialog.showModal();
}

function readStats() {
  const stats = JSON.parse(localStorage.getItem("breakaway-stats") || '{"played":0,"wins":0,"streak":0}');
  stats.totalRounds ??= 0;
  stats.roundWins ??= 0;
  return stats;
}

function updateStats(won) {
  const stats = readStats();
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.totalRounds += state.round;
    stats.roundWins += 1;
    stats.streak += 1;
  } else {
    stats.streak = 0;
  }
  localStorage.setItem("breakaway-stats", JSON.stringify(stats));
}

function showStats() {
  const stats = readStats();
  document.querySelector("#stat-played").textContent = stats.played;
  document.querySelector("#stat-wins").textContent = stats.wins;
  document.querySelector("#stat-average").textContent = stats.roundWins ? (stats.totalRounds / stats.roundWins).toFixed(1) : "—";
  document.querySelector("#stat-streak").textContent = stats.streak;
  el.statsDialog.showModal();
}

function bindEvents() {
  el.poolPicker.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pool]");
    if (!button || button.dataset.pool === state.poolMode) return;
    state.poolMode = button.dataset.pool;
    localStorage.setItem("breakaway-pool", state.poolMode);
    startRound();
  });
  el.input.addEventListener("input", renderSuggestions);
  el.input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!state.filteredSuggestions.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      state.activeSuggestion = (state.activeSuggestion + direction + state.filteredSuggestions.length) % state.filteredSuggestions.length;
      document.querySelectorAll(".suggestion").forEach((item, index) => item.classList.toggle("is-active", index === state.activeSuggestion));
    } else if (event.key === "Enter" && state.activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(state.activeSuggestion);
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  });
  el.suggestions.addEventListener("click", (event) => {
    const button = event.target.closest(".suggestion");
    if (button) chooseSuggestion(Number(button.dataset.index));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".combobox-wrap")) closeSuggestions();
  });
  el.form.addEventListener("submit", submitGuess);
  el.skipButton.addEventListener("click", skipGuess);
  el.revealButton.addEventListener("click", () => finishRound(false, false));
  document.querySelector("#next-rider-button").addEventListener("click", () => { el.resultDialog.close(); startRound(); });
  document.querySelector("#dialog-close").addEventListener("click", () => el.resultDialog.close());
  document.querySelector("#stats-button").addEventListener("click", showStats);
  document.querySelector("#stats-close").addEventListener("click", () => el.statsDialog.close());
  document.querySelector("#stats-done").addEventListener("click", () => el.statsDialog.close());
}

async function init() {
  bindEvents();
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed (${response.status})`);
    const payload = await response.json();
    state.riders = payload.riders.filter((rider) => rider.name && rider.slug);
    const savedPool = localStorage.getItem("breakaway-pool");
    state.poolMode = ["top", "wt", "pro"].includes(savedPool) ? savedPool : "wt";
    startRound();
  } catch (error) {
    el.panel.setAttribute("aria-busy", "false");
    el.feedback.className = "guess-feedback is-wrong";
    el.feedback.textContent = "The rider file could not be loaded. Serve this folder over HTTP instead of opening the HTML file directly.";
    console.error(error);
  }
}

init();
