// Simulates N phones playing a full game through the real HTTP API.
// Usage: URL=http://localhost:3000 HOST_PIN=... N=200 npm test
const URL_ = process.env.URL || 'http://localhost:3000';
const N = Number(process.env.N || 100);
const PIN = process.env.HOST_PIN || 'test-pin';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(URL_ + '/api/' + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}
const host = (method, body) => call('host', { method, body, headers: { 'x-host-pin': PIN } });
const pool = async (items, n, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; };

(async () => {
  const bad = await call('host', { headers: { 'x-host-pin': 'nope' } });
  console.log('wrong PIN rejected:', bad.status === 401);
  const created = await host('POST', { action: 'new', settings: { categories: ['ai', 'cyber', 'careers'], total: 12, chunk: 4 } });
  console.log('game created:', created.ok, 'questions:', created.questions);

  const run = Date.now().toString(36).slice(-4);
  const t0 = Date.now();
  const players = await pool([...Array(N).keys()], 40, async i => {
    const r = await call('profile', { method: 'POST', body: { nickname: `P${run}-${i}`, avatar: { hair: i % 9, skin: i % 6 }, role: 'student', interest: ['ai', 'cloud', 'cyber'][i % 3] } });
    if (!r.token) throw new Error('profile failed ' + JSON.stringify(r));
    await call('me', { headers: { 'x-player-token': r.token } });
    return { token: r.token, skill: i % 4 };
  });
  console.log(`profiles + join: ${N} in ${Date.now() - t0} ms`);
  const dup = await call('profile', { method: 'POST', body: { nickname: `p${run}-1` } });
  console.log('duplicate nickname rejected:', dup.status === 409, dup.error);
  const rude = await call('profile', { method: 'POST', body: { nickname: 'sh1t head' } });
  console.log('blocked nickname rejected:', rude.status === 400);

  let st = await host('GET');
  console.log('host sees players:', st.players, 'roster:', st.roster.length);
  const timing = [];
  let qs = 0, steps = 0;
  while (st.phase !== 'final' && steps++ < 200) {
    await host('POST', { action: 'next', v: st.v });
    st = await host('GET');
    if (st.phase === 'question') {
      qs++;
      const wait = st.openAt - Date.now();
      // early answer must be rejected
      const early = await call('answer', { method: 'POST', body: { idx: st.idx, choice: 0 }, headers: { 'x-player-token': players[0].token } });
      if (wait > 300 && early.code !== 'early') console.log('!! early answer not rejected', early);
      await sleep(Math.max(0, wait) + 50);
      const a0 = Date.now();
      await pool(players, 50, async (p, k) => {
        await sleep(Math.random() * 1500);
        const n = st.slide.options.length;
        const choice = p.skill === 0 ? 0 : Math.floor(Math.random() * n);
        const r = await call('answer', { method: 'POST', body: { idx: st.idx, choice }, headers: { 'x-player-token': p.token } });
        if (!r.ok) console.log('answer failed', r);
      });
      timing.push(Date.now() - a0);
      const again = await call('answer', { method: 'POST', body: { idx: st.idx, choice: 1 }, headers: { 'x-player-token': players[1].token } });
      if (!again.duplicate) console.log('!! duplicate answer accepted');
      st = await host('GET');
      if (st.answered !== N) console.log('!! answered count', st.answered);
    }
    if (st.phase === 'reveal' && qs <= 2) {
      const m = await call('me', { headers: { 'x-player-token': players[2].token } });
      console.log(`reveal q${st.slide.num}: counts ${st.reveal.counts.join('/')} | sample player correct=${m.answer.correct} points=${m.answer.points} rank=${m.rank}/${m.of}`);
    }
    if (st.phase === 'slide' && st.slide.type === 'match') {
      const ms = await pool(players.slice(0, 10), 10, p => call('me', { headers: { 'x-player-token': p.token } }));
      console.log('match break: players with a match:', ms.filter(m => m.match).length, '/ 10, e.g.', ms[0].match && ms[0].match.nickname);
    }
  }
  console.log('reached final:', st.phase === 'final', 'questions played:', qs, 'avg answer burst ms:', Math.round(timing.reduce((a, b) => a + b, 0) / timing.length));
  console.log('podium:', st.top.map(t => `${t.name}=${t.score}`).join(', '));
  const ranks = await pool(players, 40, p => call('me', { headers: { 'x-player-token': p.token } }));
  const set = new Set(ranks.map(r => r.rank));
  const first = ranks.find(r => r.rank === 1);
  console.log('distinct ranks:', set.size, 'of', N, '| winner rank-1 score matches podium:', !!first && !!st.top[0] && first.score === st.top[0].score);

  // the winners list the other activity reads
  const w = await call('winners');
  const places = st.places || 3;
  const expect = st.top.slice(0, places).map(t => t.name);
  const got = w.winners.slice(0, places).map(r => r.name);
  console.log('winners saved:', JSON.stringify(got), '| matches podium:', JSON.stringify(got) === JSON.stringify(expect));
  console.log('winners names list:', w.names.length >= expect.length, '| flat names:', JSON.stringify(w.names.slice(0, places)));
  const placesSeen = w.winners.slice(0, places).map(r => r.place).join(',');
  console.log('places numbered 1..' + places + ':', placesSeen === Array.from({ length: places }, (_, i) => i + 1).join(','));
  // advancing again at the final screen must not append the podium twice
  await host('POST', { action: 'next', v: st.v });
  const w2 = await call('winners');
  console.log('winners recorded once only:', w2.count === w.count, `(${w.count})`);
  const stale = await host('POST', { action: 'next', v: st.v - 3 });
  console.log('stale host action ignored:', stale.stale === true || stale.ok === true);
  const pub = await fetch(URL_ + '/api/state');
  const pj = await pub.json();
  console.log('public state cache header:', pub.headers.get('cache-control'), '| leaks answer key:', JSON.stringify(pj).includes('"answer"') && pj.phase !== 'reveal');
})().catch(e => { console.error(e); process.exit(1); });
