import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './http.js';
import { BANK, CATEGORIES, DEFAULT_CATEGORIES, TALK_PROMPTS } from './bank.js';
import { playerByToken, ROLES, INTERESTS } from './profile.js';

export const READ_MS = 3500;       // question shows alone before answers unlock
const LATE_GRACE_MS = 1500;        // network grace after the timer hits zero

const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const clamp = (n, lo, hi, d) => (Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Math.round(Number(n)))) : d);

export async function currentGame(sql = db()) {
  const [g] = await sql`select * from pc_games order by created_at desc limit 1`;
  return g || null;
}

// ---------- question bank ----------
const bankKey = q => crypto.createHash('sha1').update(q.text).digest('hex');
const BANK_HASH = crypto.createHash('sha1').update(JSON.stringify(BANK)).digest('hex');
let bankSynced = false;

export async function syncBank(sql = db()) {
  if (bankSynced) return;
  const [meta] = await sql`select value from pc_meta where key = 'bank_hash'`;
  if (meta && meta.value === BANK_HASH) { bankSynced = true; return; }
  await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(724202)`;
    const keys = [];
    for (const q of BANK) {
      const key = bankKey(q);
      keys.push(key);
      await tx`
        insert into pc_questions (key, category, difficulty, text, options, answer, fact, time_s)
        values (${key}, ${q.category}, ${q.difficulty}, ${q.text}, ${tx.json(q.options)}, ${q.answer}, ${q.fact}, ${q.time})
        on conflict (key) do update set category = excluded.category, difficulty = excluded.difficulty,
          options = excluded.options, answer = excluded.answer, fact = excluded.fact, time_s = excluded.time_s, active = true`;
    }
    await tx`update pc_questions set active = false where not (key = any(${tx.array(keys)}::text[]))`;
    await tx`insert into pc_meta (key, value) values ('bank_hash', ${tx.json(BANK_HASH)})
             on conflict (key) do update set value = excluded.value`;
  });
  bankSynced = true;
}

export async function bankStats(sql = db()) {
  const rows = await sql`
    select category, count(*)::int total, count(*) filter (where times_used = 0)::int fresh
    from pc_questions where active group by category`;
  const by = Object.fromEntries(rows.map(r => [r.category, r]));
  return Object.entries(CATEGORIES).map(([id, c]) => ({
    id, title: c.title, blurb: c.blurb, total: by[id]?.total || 0, fresh: by[id]?.fresh || 0
  }));
}

function questionSlide(row, round, extra = {}) {
  const order = row.options.length > 2 ? shuffle(row.options.map((_, i) => i)) : row.options.map((_, i) => i);
  return {
    type: 'q', round, qid: row.id, cat: row.category, catTitle: CATEGORIES[row.category]?.title || '',
    text: row.text, options: order.map(i => row.options[i]), answer: order.indexOf(row.answer),
    fact: row.fact, time: row.time_s, ...extra
  };
}

export async function newGame(settings = {}) {
  const sql = db();
  await syncBank(sql);
  const cats = (Array.isArray(settings.categories) ? settings.categories : DEFAULT_CATEGORIES)
    .filter(c => CATEGORIES[c]).slice(0, 8);
  if (!cats.length) throw new HttpError(400, 'Pick at least one category.');
  const perRound = clamp(settings.perRound, 2, 6, 4);
  const breaks = settings.breaks !== false;
  const final = settings.final !== false;

  return sql.begin(async tx => {
    const plan = [];
    const used = [];
    let breakNo = 0;
    const talk = shuffle(TALK_PROMPTS);
    const rounds = [];
    for (const cat of cats) {
      const qs = await tx`
        select * from pc_questions where category = ${cat} and active
        order by times_used asc, random() limit ${perRound}`;
      if (qs.length) rounds.push({ cat, qs });
    }
    if (!rounds.length) throw new HttpError(400, 'No questions found for those categories.');

    rounds.forEach((r, i) => {
      plan.push({ type: 'round', round: i, title: CATEGORIES[r.cat].title, subtitle: `Round ${i + 1} of ${rounds.length}`, blurb: CATEGORIES[r.cat].blurb });
      for (const row of r.qs) { plan.push(questionSlide(row, i)); used.push(row.id); }
      if (breaks && i % 2 === 1 && i < rounds.length - 1) {
        plan.push(breakNo % 2 === 0
          ? { type: 'match', title: 'Meet your match', text: 'Your phone shows one player to find. Say hi and swap LinkedIns.', seconds: 60 }
          : { type: 'talk', title: 'Talk break', text: talk[breakNo % talk.length], seconds: 45 });
        breakNo++;
      }
    });

    if (final) {
      const [row] = await tx`
        select * from pc_questions
        where category = any(${tx.array(rounds.map(r => r.cat))}::text[]) and active and not (id = any(${tx.array(used.length ? used : [0])}::int[]))
        order by difficulty desc, times_used asc, random() limit 1`;
      if (row) {
        plan.push({ type: 'round', round: 'final', title: 'Final question', subtitle: 'Double points. Anything can happen.' });
        plan.push(questionSlide(row, 'final', { double: true }));
        used.push(row.id);
      }
    }

    const total = plan.filter(s => s.type === 'q').length;
    let n = 0;
    for (const s of plan) if (s.type === 'q') { s.num = ++n; s.total = total; }

    await tx`update pc_questions set times_used = times_used + 1 where id = any(${tx.array(used)}::int[])`;
    const [g] = await tx`
      insert into pc_games (plan, settings) values (${tx.json(plan)}, ${tx.json({ categories: cats, perRound, breaks, final })})
      returning id`;
    return { ok: true, id: g.id, questions: total };
  });
}

// ---------- public views ----------
function slideView(s) {
  if (!s) return null;
  if (s.type === 'q') {
    return { type: 'q', round: s.round, catTitle: s.catTitle, text: s.text, options: s.options, time: s.time, double: !!s.double, num: s.num, total: s.total };
  }
  return { type: s.type, title: s.title, subtitle: s.subtitle || '', text: s.text || '', blurb: s.blurb || '', seconds: s.seconds || 0 };
}

async function top(sql, gameId, n) {
  return sql`
    select p.id, p.nickname as name, p.avatar, gp.score, gp.correct
    from pc_game_players gp join pc_players p on p.id = gp.player_id
    where gp.game_id = ${gameId}
    order by gp.score desc, gp.total_ms asc, gp.joined_at asc limit ${n}`;
}

export async function publicState(sql = db(), g) {
  if (g === undefined) g = await currentGame(sql);
  if (!g) return { v: 0, phase: 'none' };
  const [{ n }] = await sql`select count(*)::int as n from pc_game_players where game_id = ${g.id}`;
  const st = { v: g.version, id: g.id, phase: g.phase, idx: g.idx, players: n };
  const s = g.plan[g.idx];
  if (s && g.phase !== 'lobby' && g.phase !== 'final') st.slide = slideView(s);
  if (g.phase === 'question') { st.openAt = +g.q_open_at; st.endsAt = +g.q_ends_at; }
  if (g.phase === 'reveal') st.reveal = g.reveal;
  if (g.phase === 'leaderboard' || g.phase === 'final') st.top = (await top(sql, g.id, 5)).map(({ id, ...r }) => r);
  return st;
}

export async function hostState() {
  const sql = db();
  const g = await currentGame(sql);
  const st = await publicState(sql, g);
  st.bank = await bankStats(sql);
  if (!g) return st;
  st.settings = g.settings;
  st.plan = g.plan.map(s => (s.type === 'q' ? { type: 'q', num: s.num, round: s.round } : { type: s.type, title: s.title }));
  if (g.phase === 'question') {
    const [{ n }] = await sql`select count(*)::int as n from pc_answers where game_id = ${g.id} and idx = ${g.idx}`;
    st.answered = n;
  }
  if (g.phase === 'lobby') {
    st.roster = await sql`
      select p.id, p.nickname as name, p.avatar, p.interest from pc_game_players gp join pc_players p on p.id = gp.player_id
      where gp.game_id = ${g.id} order by gp.joined_at desc limit 120`;
  }
  return st;
}

// ---------- host flow ----------
export async function advance(expectedVersion) {
  const sql = db();
  return sql.begin(async tx => {
    const [g] = await tx`select * from pc_games order by created_at desc limit 1 for update`;
    if (!g) throw new HttpError(409, 'Create a game first.');
    if (expectedVersion !== undefined && expectedVersion !== null && Number(expectedVersion) !== g.version) {
      return { ok: false, stale: true, v: g.version };
    }
    const plan = g.plan;
    if (g.phase === 'final') return { ok: true, v: g.version };
    if (g.phase === 'question') return reveal(tx, g);
    if (g.phase === 'reveal') {
      const nxt = plan[g.idx + 1];
      if (!nxt) return setPhase(tx, g, 'final', plan.length);
      if (nxt.type === 'q' && nxt.round === plan[g.idx].round) return startQuestion(tx, g, g.idx + 1);
      return setPhase(tx, g, 'leaderboard', g.idx);
    }
    const i = g.idx + 1;
    if (i >= plan.length) return setPhase(tx, g, 'final', plan.length);
    const s = plan[i];
    if (s.type === 'q') return startQuestion(tx, g, i);
    if (s.type === 'match') await makeMatches(tx, g);
    return setPhase(tx, g, 'slide', i);
  });
}

async function setPhase(tx, g, phase, idx) {
  const [r] = await tx`update pc_games set phase = ${phase}, idx = ${idx}, version = version + 1 where id = ${g.id} returning version`;
  return { ok: true, v: r.version };
}

async function startQuestion(tx, g, idx) {
  const s = g.plan[idx];
  const open = new Date(Date.now() + READ_MS);
  const ends = new Date(open.getTime() + s.time * 1000);
  const [r] = await tx`
    update pc_games set phase = 'question', idx = ${idx}, q_open_at = ${open}, q_ends_at = ${ends}, reveal = null, version = version + 1
    where id = ${g.id} returning version`;
  return { ok: true, v: r.version };
}

async function reveal(tx, g) {
  const s = g.plan[g.idx];
  const timeMs = s.time * 1000;
  const answers = await tx`select player_id, choice, ms from pc_answers where game_id = ${g.id} and idx = ${g.idx}`;
  const players = await tx`select player_id, streak from pc_game_players where game_id = ${g.id}`;
  const byPlayer = new Map(answers.map(a => [a.player_id, a]));
  const counts = s.options.map(() => 0);
  const ids = [], adds = [], streaks = [], corrects = [], mss = [];
  for (const p of players) {
    const a = byPlayer.get(p.player_id);
    let add = 0, streak = 0, c = 0, ms = 0;
    if (a) {
      counts[a.choice]++;
      if (a.choice === s.answer) {
        streak = p.streak + 1;
        add = Math.round(1000 * (1 - Math.min(a.ms, timeMs) / timeMs / 2)) + Math.min(streak - 1, 5) * 100;
        if (s.double) add *= 2;
        c = 1; ms = a.ms;
      }
    }
    ids.push(p.player_id); adds.push(add); streaks.push(streak); corrects.push(c); mss.push(ms);
  }
  if (ids.length) {
    await tx`
      update pc_game_players gp set score = gp.score + v.add, streak = v.streak, correct = gp.correct + v.c, total_ms = gp.total_ms + v.ms
      from (select unnest(${tx.array(ids)}::uuid[]) as pid, unnest(${tx.array(adds)}::int[]) as add,
                   unnest(${tx.array(streaks)}::int[]) as streak, unnest(${tx.array(corrects)}::int[]) as c,
                   unnest(${tx.array(mss)}::int[]) as ms) v
      where gp.game_id = ${g.id} and gp.player_id = v.pid`;
    await tx`
      update pc_answers a set correct = (a.choice = ${s.answer}), points = v.add
      from (select unnest(${tx.array(ids)}::uuid[]) as pid, unnest(${tx.array(adds)}::int[]) as add) v
      where a.game_id = ${g.id} and a.idx = ${g.idx} and a.player_id = v.pid`;
  }
  const [r] = await tx`
    update pc_games set phase = 'reveal', reveal = ${tx.json({ answer: s.answer, counts, fact: s.fact })}, version = version + 1
    where id = ${g.id} returning version`;
  return { ok: true, v: r.version };
}

async function makeMatches(tx, g) {
  const ps = await tx`
    select p.id, p.interest from pc_game_players gp join pc_players p on p.id = gp.player_id where gp.game_id = ${g.id}`;
  const list = shuffle(ps).sort((a, b) => (a.interest || 'zz').localeCompare(b.interest || 'zz'));
  const matches = {};
  for (let i = 0; i + 1 < list.length; i += 2) {
    matches[list[i].id] = list[i + 1].id;
    matches[list[i + 1].id] = list[i].id;
  }
  if (list.length % 2 === 1 && list.length > 1) {
    const odd = list[list.length - 1];
    matches[odd.id] = list[list.length - 2].id; // joins the last pair as a trio
  }
  await tx`update pc_games set matches = ${tx.json(matches)} where id = ${g.id}`;
}

export async function kick(playerId) {
  if (typeof playerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(playerId)) throw new HttpError(400, 'Unknown player.');
  await db()`delete from pc_players where id = ${playerId}`;
  return { ok: true };
}

// ---------- player flow ----------
export async function me(token) {
  const sql = db();
  const p = await playerByToken(token);
  const g = await currentGame(sql);
  const profile = { id: p.id, nickname: p.nickname, avatar: p.avatar, role: p.role, interest: p.interest };
  if (!g) return { profile, game: null };
  await sql`insert into pc_game_players (game_id, player_id) values (${g.id}, ${p.id}) on conflict do nothing`;
  const [gp] = await sql`select score, streak, correct, total_ms, joined_at from pc_game_players where game_id = ${g.id} and player_id = ${p.id}`;
  const [{ rank, of }] = await sql`
    select count(*) filter (where score > ${gp.score}
        or (score = ${gp.score} and total_ms < ${gp.total_ms})
        or (score = ${gp.score} and total_ms = ${gp.total_ms} and joined_at < ${gp.joined_at}))::int + 1 as rank,
      count(*)::int as of
    from pc_game_players where game_id = ${g.id}`;
  const out = { profile, game: g.id, v: g.version, idx: g.idx, phase: g.phase, score: gp.score, streak: gp.streak, correct: gp.correct, rank, of };
  const s = g.plan[g.idx];
  if (s && s.type === 'q') {
    const [a] = await sql`select choice, correct, points from pc_answers where game_id = ${g.id} and idx = ${g.idx} and player_id = ${p.id}`;
    out.answer = a ? { idx: g.idx, choice: a.choice, correct: g.phase === 'question' ? null : a.correct, points: g.phase === 'question' ? null : a.points }
                   : { idx: g.idx, choice: null };
  }
  if (s && s.type === 'match' && g.phase === 'slide' && g.matches && g.matches[p.id]) {
    const [m] = await sql`select nickname, avatar, role, interest from pc_players where id = ${g.matches[p.id]}`;
    if (m) out.match = { ...m, roleLabel: ROLES[m.role] || '', interestLabel: INTERESTS[m.interest] || '', sameInterest: !!p.interest && p.interest === m.interest };
  }
  return out;
}

export async function answer(token, body) {
  const sql = db();
  const p = await playerByToken(token);
  const g = await currentGame(sql);
  const now = Date.now();
  const idx = Number(body.idx);
  if (!g || g.phase !== 'question' || g.idx !== idx) throw new HttpError(409, 'This question is closed.', { code: 'closed' });
  if (now < +g.q_open_at - 300) throw new HttpError(409, 'Answers aren’t open yet.', { code: 'early' });
  if (now > +g.q_ends_at + LATE_GRACE_MS) throw new HttpError(409, 'Time’s up for this one.', { code: 'closed' });
  const s = g.plan[idx];
  const choice = Number(body.choice);
  if (!Number.isInteger(choice) || choice < 0 || choice >= s.options.length) throw new HttpError(400, 'Invalid choice.');
  await sql`insert into pc_game_players (game_id, player_id) values (${g.id}, ${p.id}) on conflict do nothing`;
  const ms = Math.max(0, Math.min(now - +g.q_open_at, s.time * 1000));
  const r = await sql`
    insert into pc_answers (game_id, player_id, idx, choice, ms) values (${g.id}, ${p.id}, ${idx}, ${choice}, ${ms})
    on conflict do nothing returning choice`;
  return { ok: true, duplicate: r.length === 0 };
}
