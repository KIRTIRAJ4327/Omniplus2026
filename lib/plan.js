// Assembling a game plan from questions already drawn out of the database.
// Deliberately free of any database import so `npm run check` can test the plan
// shape — which is what the host flow in advance() depends on — with no
// dependencies installed and no Postgres running.
import crypto from 'node:crypto';
import { CATEGORIES } from './bank.js';

// Host-configurable bounds. Sent to the host screen as st.ranges so the controls
// and the server can never disagree about what is allowed.
export const TOTAL_RANGE = { min: 4, max: 60, def: 24 };
export const CHUNK_RANGE = { min: 3, max: 10, def: 6 };

export const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export const clamp = (n, lo, hi, d) =>
  (Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Math.round(Number(n)))) : d);

export function questionSlide(row, round, extra = {}) {
  const order = row.options.length > 2 ? shuffle(row.options.map((_, i) => i)) : row.options.map((_, i) => i);
  return {
    type: 'q', round, qid: row.id, cat: row.category, catTitle: CATEGORIES[row.category]?.title || '',
    text: row.text, options: order.map(i => row.options[i]), answer: order.indexOf(row.answer),
    fact: row.fact, time: row.time_s, ...extra
  };
}

// Draws `want` questions from per-category pools, taking one from each category in
// turn with the category order reshuffled on every pass. Keeps the mix even across
// the categories the host picked without settling into a predictable rotation.
// Pools are consumed in place; each is already ordered least-used first.
export function pickRoundRobin(pools, want) {
  const picked = [];
  while (picked.length < want) {
    const live = shuffle(pools.filter(pool => pool.length));
    if (!live.length) break;              // the bank ran out before we hit `want`
    for (const pool of live) {
      if (picked.length >= want) break;
      picked.push(pool.shift());
    }
  }
  return picked;
}

// `round` is what tells advance() when to stop for a leaderboard, so numbering the
// chunks is what produces a leaderboard every `chunk` questions.
export function buildPlan({ picked, chunk, breaks = true, finalRow = null, categories = 0, talkPrompts = [] }) {
  const plan = [];
  const used = [];
  const chunks = Math.max(1, Math.ceil(picked.length / chunk));

  plan.push({
    type: 'round', round: 'intro', title: 'Pulse Check',
    subtitle: `${picked.length} question${picked.length === 1 ? '' : 's'} from ${categories} ${categories === 1 ? 'category' : 'categories'}`,
    blurb: 'Answers unlock on every phone at the same moment. Faster correct answers score more.'
  });

  const talk = shuffle(talkPrompts);
  let breakNo = 0;
  picked.forEach((row, i) => {
    const at = Math.floor(i / chunk);
    plan.push(questionSlide(row, at));
    used.push(row.id);
    // A break goes after every second chunk, but never after the last one: the
    // leaderboard and then the final question follow there instead.
    const endOfChunk = (i + 1) % chunk === 0 || i === picked.length - 1;
    if (breaks && endOfChunk && at < chunks - 1 && at % 2 === 1 && talk.length) {
      plan.push(breakNo % 2 === 0
        ? { type: 'match', title: 'Meet your match', text: 'Your phone shows one player to find. Say hi and swap LinkedIns.', seconds: 60 }
        : { type: 'talk', title: 'Talk break', text: talk[breakNo % talk.length], seconds: 45 });
      breakNo++;
    }
  });

  if (finalRow) {
    plan.push({ type: 'round', round: 'final', title: 'Final question', subtitle: 'Double points. Anything can happen.' });
    plan.push(questionSlide(finalRow, 'final', { double: true }));
    used.push(finalRow.id);
  }

  const total = plan.filter(s => s.type === 'q').length;
  let n = 0;
  for (const s of plan) if (s.type === 'q') { s.num = ++n; s.total = total; }

  return { plan, used, total, chunks };
}
