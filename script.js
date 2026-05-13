// ─────────────────────────────────────────────────────────────
// Horse Race — web edition
// Logic mirrors the original Swift ViewController:
//   • 4 suits (C, D, H, S), each with positions 1..6
//   • Draw random card, remove from deck, advance matching suit one space
//   • When a horse moves into position 6, it finishes:
//       - all remaining cards of that suit are removed from the deck
//       - place counter is assigned then incremented
//   • Prize text depends on the selected race type
// ─────────────────────────────────────────────────────────────

const SUITS = [
  { key: "C", name: "Clubs",    glyph: "♣", color: "black" },
  { key: "D", name: "Diamonds", glyph: "♦", color: "red"   },
  { key: "H", name: "Hearts",   glyph: "♥", color: "red"   },
  { key: "S", name: "Spades",   glyph: "♠", color: "black" },
];

const RANKS = ["A","2","3","4","5","6","7","8","9","T","J","Q","K"];

const PRIZES = {
  savings: {
    label: "Savings Race Payouts",
    1: "$5,000",
    2: "$3,000",
    3: "$2,000",
    4: "$1,000",
  },
  loans: {
    label: "Student Loan Race",
    1: "$1,000\nMonthly: $10",
    2: "$10,000\nMonthly: $95",
    3: "$29,000\nMonthly: $276",
    4: "$45,000\nMonthly: $429",
  },
  furniture: {
    label: "Furniture Race",
    1: "Silverware & Dishes",
    2: "TV",
    3: "Couch",
    4: "Bed Frame + Mattress",
  },
};

const PLACE_LABEL = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };

// ───── State ─────
let deck = [];
let positions = {};   // suit key -> 1..6
let finished  = {};   // suit key -> { place, prize }
let place = 1;
let raceType = "savings";
let animating = false;

// ───── DOM refs ─────
const trackEl       = document.getElementById("track");
const drawBtn       = document.getElementById("drawBtn");
const resetBtn      = document.getElementById("resetBtn");
const deckCountEl   = document.getElementById("deckCount");
const drawnCardEl   = document.getElementById("drawnCard");
const overlayEl     = document.getElementById("resultsOverlay");
const resultsGridEl = document.getElementById("resultsGrid");
const resultsSubEl  = document.getElementById("resultsSub");
const resultsResetBtn = document.getElementById("resultsReset");
const segButtons    = document.querySelectorAll(".seg");

// ───── Build the track ─────
function buildTrack() {
  trackEl.innerHTML = "";
  SUITS.forEach(s => {
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.dataset.suit = s.key;

    const badge = document.createElement("div");
    badge.className = `suit-badge ${s.color}`;
    badge.textContent = s.glyph;

    const spaces = document.createElement("div");
    spaces.className = "spaces";
    for (let i = 1; i <= 6; i++) {
      const sp = document.createElement("div");
      sp.className = "space" + (i === 6 ? " finish" : "");
      const n = document.createElement("span");
      n.className = "pos-num";
      n.textContent = i === 6 ? "FINISH" : i;
      sp.appendChild(n);
      spaces.appendChild(sp);
    }

    const horse = document.createElement("div");
    horse.className = "horse";
    horse.dataset.suit = s.key;
    const img = document.createElement("img");
    img.src = `cards/A${s.key}.png`;
    img.alt = `Ace of ${s.name}`;
    horse.appendChild(img);
    spaces.appendChild(horse);

    const tag = document.createElement("div");
    tag.className = "place-tag";

    lane.appendChild(badge);
    lane.appendChild(spaces);
    lane.appendChild(tag);
    trackEl.appendChild(lane);
  });
  placeAllHorses();
}

function placeAllHorses() {
  SUITS.forEach(s => placeHorse(s.key));
}

// Horse left% offset for position p (1..6).
// Track has 6 columns + 5 gaps of 8px. Compute the left edge of column p (1-indexed)
// as a percentage of the spaces container width.
function leftForPosition(p) {
  // The horse width matches one column (see CSS). So left in % equals
  // column index proportion, but we need to account for the 8px gaps.
  // Use calc-friendly value: (p-1) * (cellWidth + gap)
  // Express as: (p - 1) / 6 of full row, then add gap offset.
  return `calc(((100% - 5 * 8px) / 6 + 8px) * ${p - 1})`;
}

function placeHorse(suitKey) {
  const horse = trackEl.querySelector(`.horse[data-suit="${suitKey}"]`);
  if (!horse) return;
  horse.style.left = leftForPosition(positions[suitKey]);
}

// ───── Deck ─────
function buildDeck() {
  deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) deck.push(r + s.key);
  }
}

function updateDeckCount() {
  deckCountEl.textContent = deck.length;
}

// ───── Reset ─────
function resetRace() {
  buildDeck();
  positions = { C: 1, D: 1, H: 1, S: 1 };
  finished  = {};
  place = 1;
  animating = false;

  // Clear drawn card
  drawnCardEl.innerHTML = '<div class="drawn-empty">—</div>';
  drawnCardEl.classList.remove("dealing");

  // Rebuild horses (cleanest way to reset .finished etc.)
  buildTrack();

  // Clear place tags & finished classes
  document.querySelectorAll(".place-tag").forEach(t => {
    t.classList.remove("show");
    t.textContent = "";
  });

  drawBtn.disabled = false;
  drawBtn.textContent = "Draw Card";
  updateDeckCount();
  hideResults();
}

// ───── Draw logic ─────
function drawCard() {
  if (animating) return;
  if (deck.length === 0) return;

  // Pick + remove
  const idx = Math.floor(Math.random() * deck.length);
  const card = deck.splice(idx, 1)[0];
  const suit = card.slice(-1);

  // Show drawn card
  drawnCardEl.classList.remove("dealing");
  // restart animation
  void drawnCardEl.offsetWidth;
  drawnCardEl.innerHTML = `<img src="cards/${card}.png" alt="${card}" />`;
  drawnCardEl.classList.add("dealing");

  // Advance that suit's horse (unless already finished)
  if (!finished[suit]) {
    advance(suit);
  }

  updateDeckCount();

  if (deck.length === 0) {
    drawBtn.disabled = true;
  }
}

function advance(suit) {
  const horse = trackEl.querySelector(`.horse[data-suit="${suit}"]`);
  const lane  = trackEl.querySelector(`.lane[data-suit="${suit}"]`);
  const cur   = positions[suit];

  // Mirror the Swift logic:
  //  positions 1..4 → move forward one and bump position
  //  position >= 5  → move to 6 and finish
  let next;
  let willFinish = false;
  if (cur >= 5) {
    next = 6;
    willFinish = true;
  } else {
    next = cur + 1;
  }

  animating = true;
  positions[suit] = next;
  horse.style.left = leftForPosition(next);

  const onDone = () => {
    horse.removeEventListener("transitionend", onDone);
    animating = false;

    if (willFinish) {
      // Mark finished, remove remaining suit cards from deck (mirror Swift)
      deck = deck.filter(c => !c.endsWith(suit));
      updateDeckCount();

      const finishPlace = place;
      place += 1;
      const prize = PRIZES[raceType][finishPlace];
      finished[suit] = { place: finishPlace, prize };

      horse.classList.add("finished");

      const tag = lane.querySelector(".place-tag");
      tag.textContent = PLACE_LABEL[finishPlace];
      tag.classList.add("show");

      // Race over?
      if (Object.keys(finished).length === 4) {
        drawBtn.disabled = true;
        drawBtn.textContent = "Race Complete";
        setTimeout(showResults, 600);
      }
    }
  };

  horse.addEventListener("transitionend", onDone);
  // Fallback in case transitionend doesn't fire (e.g., no movement)
  setTimeout(() => {
    if (animating) onDone();
  }, 1100);
}

// ───── Results ─────
function showResults() {
  const prizes = PRIZES[raceType];
  resultsSubEl.textContent = prizes.label;

  // Build in finishing order
  const ordered = SUITS
    .map(s => ({ suit: s, info: finished[s.key] }))
    .filter(x => x.info)
    .sort((a, b) => a.info.place - b.info.place);

  resultsGridEl.innerHTML = "";
  ordered.forEach(({ suit, info }) => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.dataset.place = info.place;

    card.innerHTML = `
      <div class="result-place">${PLACE_LABEL[info.place]}</div>
      <div class="result-suit ${suit.color}">${suit.glyph}</div>
      <div class="result-name">${suit.name}</div>
      <div class="result-prize">${info.prize}</div>
    `;
    resultsGridEl.appendChild(card);
  });

  overlayEl.classList.add("show");
  overlayEl.setAttribute("aria-hidden", "false");
}

function hideResults() {
  overlayEl.classList.remove("show");
  overlayEl.setAttribute("aria-hidden", "true");
}

// ───── Race type segmented control ─────
segButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    segButtons.forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    raceType = btn.dataset.race;
  });
});

// ───── Wire up ─────
drawBtn.addEventListener("click", drawCard);
resetBtn.addEventListener("click", resetRace);
resultsResetBtn.addEventListener("click", resetRace);

// Init
resetRace();
