const SHAPES = [
  '<svg class="shape" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 22.5 20.5h-21z"/></svg>',
  '<svg class="shape" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 22.5 12 12 22.5 1.5 12z"/></svg>',
  '<svg class="shape" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5"/></svg>',
  '<svg class="shape" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="1.5"/></svg>'
];
const SHAPE_NAMES = ['Triangle', 'Diamond', 'Circle', 'Square'];
const INTEREST_LABELS = { ai: 'AI', cyber: 'Cybersecurity', cloud: 'Cloud', data: 'Data', dev: 'Software dev', design: 'Design and product' };
const ROLE_LABELS = { student: 'Student', jobseeker: 'Job seeker', pro: 'Working in tech' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error(data.error || `Request failed (${res.status})`); err.status = res.status; err.code = data.code; throw err; }
  return data;
}

// Server clock offset, so every screen unlocks answers at the same moment.
const Clock = {
  offset: 0,
  async sync() {
    let best = null;
    for (let i = 0; i < 3; i++) {
      try {
        const t0 = Date.now();
        const { now } = await api('time');
        const t1 = Date.now();
        if (!best || t1 - t0 < best.rtt) best = { rtt: t1 - t0, offset: now - (t0 + t1) / 2 };
      } catch (e) {}
    }
    if (best) this.offset = best.offset;
  },
  now() { return Date.now() + this.offset; }
};

// Polls a state endpoint and calls onChange when the version changes.
function startPolling(fetcher, onChange, { interval = 1000, onError } = {}) {
  let last = null, stopped = false, fails = 0;
  (async function loop() {
    while (!stopped) {
      try {
        const st = await fetcher();
        fails = 0;
        onError && onError(null);
        const key = [st.v, st.id || '', st.players ?? '', st.answered ?? '', st.roster ? st.roster.length : '', st.winners ? st.winners.count : ''].join(':');
        if (key !== last) { last = key; onChange(st); }
      } catch (e) {
        fails++;
        onError && onError(e, fails);
      }
      await sleep(document.hidden ? 4000 : fails ? Math.min(5000, interval * (fails + 1)) : interval);
    }
  })();
  return () => { stopped = true; };
}

function ecgPath(w = 1200, h = 56) {
  const m = h / 2;
  let d = `M0 ${m}`;
  for (let x = 0; x < w - 120; x += 150) d += ` L${x + 40} ${m} l8 -6 l8 6 l10 0 l5 8 l7 -38 l7 46 l5 -16 l10 0 l10 -7 l10 7`;
  return d + ` L${w} ${m}`;
}
function ecgSvg() {
  const d = ecgPath();
  return `<svg class="ecg" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden="true"><path class="base" d="${d}"/><path class="live" d="${d}" pathLength="1000"/></svg>`;
}
function ecgIdle(root) {
  const live = root.querySelector('.ecg .live');
  if (live) { live.style.transition = 'none'; live.style.opacity = 0; }
}
// Drains the pulse line until `endsAt` (server time). Returns a stop function.
function ecgCountdown(root, endsAt, totalMs, onTick) {
  const live = root.querySelector('.ecg .live');
  const left0 = Math.max(0, endsAt - Clock.now());
  if (live) {
    live.style.transition = 'none';
    live.style.opacity = 1;
    live.style.strokeDashoffset = Math.min(1000, Math.max(0, (1 - left0 / totalMs) * 1000));
    live.getBoundingClientRect();
    live.style.transition = `stroke-dashoffset ${left0}ms linear`;
    live.style.strokeDashoffset = 1000;
  }
  let id;
  const tick = () => {
    const left = Math.max(0, endsAt - Clock.now());
    onTick && onTick(Math.ceil(left / 1000), left);
    if (left <= 0) clearInterval(id);
  };
  tick();
  id = setInterval(tick, 150);
  return () => clearInterval(id);
}

// Runs `fn` at server time `at` (or now if already past). Returns cancel.
function atServerTime(at, fn) {
  const t = setTimeout(fn, Math.max(0, at - Clock.now()));
  return () => clearTimeout(t);
}
