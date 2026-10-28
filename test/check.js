// Offline checks. No database, no network, no browser: safe to run anywhere.
//   npm run check
// Covers the question bank, every SVG the pages can draw, and that all the
// client-side JavaScript parses.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK, CATEGORIES, DEFAULT_CATEGORIES } from '../lib/bank.js';
import { parseMentors, mentorsToText, MAX_MENTORS } from '../lib/mentor-text.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let fails = 0;
const fail = m => { fails++; console.log('FAIL ' + m); };
const ok = m => console.log('ok   ' + m);

// ---------- 1. question bank ----------
{
  const seen = new Map();
  let bad = 0;
  BANK.forEach((q, i) => {
    const at = `question ${i} (${q.category})`;
    if (!CATEGORIES[q.category]) { fail(`${at}: unknown category`); bad++; }
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) { fail(`${at}: ${(q.options || []).length} options`); bad++; }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) { fail(`${at}: answer index ${q.answer} out of range`); bad++; }
    if (new Set(q.options.map(o => String(o).toLowerCase())).size !== q.options.length) { fail(`${at}: duplicate options`); bad++; }
    if (!q.fact) { fail(`${at}: no fact to show on the reveal`); bad++; }
    if (!(q.time >= 5 && q.time <= 60)) { fail(`${at}: time ${q.time}s`); bad++; }
    if (![1, 2, 3].includes(q.difficulty)) { fail(`${at}: difficulty ${q.difficulty}`); bad++; }
    const k = q.text.trim().toLowerCase();
    // The bank is keyed on question text, so two identical texts collapse into one row.
    if (seen.has(k)) { fail(`${at}: same text as question ${seen.get(k)}`); bad++; } else seen.set(k, i);
  });
  if (!bad) ok(`question bank: ${BANK.length} questions, all valid`);
  for (const c of DEFAULT_CATEGORIES) if (!CATEGORIES[c]) fail(`DEFAULT_CATEGORIES names "${c}", which is not a category`);
  const counts = {};
  for (const q of BANK) counts[q.category] = (counts[q.category] || 0) + 1;
  for (const [id, c] of Object.entries(CATEGORIES)) {
    if (!counts[id]) fail(`category "${id}" (${c.title}) has no questions`);
    else if (counts[id] < 5) console.log(`note  category "${id}" has only ${counts[id]} questions, so rounds of 5 will be short`);
  }
  ok('per category: ' + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
}

// ---------- 2. every SVG the pages can draw ----------
const TAG_RE = new RegExp('<(/?)([a-zA-Z][\\w:-]*)((?:[^>"\']|"[^"]*"|\'[^\']*\')*?)(/?)>', 'g');
const ATTR_RE = new RegExp('\\s+[\\w:-]+\\s*=\\s*("[^"]*"|\'[^\']*\')', 'g');

function svgErrors(svg) {
  const errs = [];
  if (!svg.startsWith('<svg') || !svg.trimEnd().endsWith('</svg>')) errs.push('not wrapped in <svg>');
  const stack = [];
  const re = new RegExp(TAG_RE.source, 'g');
  let m, n = 0;
  while ((m = re.exec(svg))) {
    n++;
    const [, close, name, attrs, self] = m;
    if (close) { if (stack.pop() !== name) errs.push(`mismatched </${name}>`); }
    else if (!self) stack.push(name);
    const stray = attrs.replace(new RegExp(ATTR_RE.source, 'g'), '').trim();
    if (stray) errs.push(`stray attribute text in <${name}>: ${stray}`);
  }
  if (!n) errs.push('no tags');
  if (stack.length) errs.push('unclosed: ' + stack.join(','));
  if (/undefined|NaN|\[object/.test(svg)) errs.push('a template left undefined/NaN in the output');
  return errs;
}

{
  const ctx = { console };
  vm.createContext(ctx);
  const src = ['public/avatar.js', 'public/art.js'].map(read).join('\n');
  // top-level const/let don't land on the context object, so hand them back
  const exp = vm.runInContext(src + ';({ AVATAR_PRESETS, AV });', ctx);

  let bad = 0;
  for (const id of [...Object.keys(CATEGORIES), '__missing__']) {
    const svg = ctx.categoryArt(id, { width: 240, label: id });
    const errs = svgErrors(svg);
    const drawn = (svg.match(/<(path|circle|rect)\b/g) || []).length;
    if (drawn < 2) errs.push(`only ${drawn} drawable elements`);
    if (errs.length) { fail(`art "${id}": ${errs.join('; ')}`); bad++; }
  }
  if (!bad) ok(`category art: ${Object.keys(CATEGORIES).length} categories + fallback, all well-formed`);

  for (const place of [1, 2, 3]) {
    const svg = ctx.medalArt(place, 56);
    const errs = svgErrors(svg);
    if (!svg.includes('>' + place + '<')) errs.push('place number missing');
    if (errs.length) fail(`medal ${place}: ${errs.join('; ')}`);
  }
  ok('podium medals: 1st, 2nd, 3rd all well-formed');

  // Every avatar part value, so no combination can render broken on the big screen.
  let combos = 0, avBad = 0;
  for (const [k, list] of Object.entries(exp.AV)) {
    for (let v = 0; v < list.length; v++) {
      const errs = svgErrors(ctx.avatarSvg({ ...exp.AVATAR_PRESETS[0].avatar, [k]: v }, { size: 64, label: 'player' }));
      combos++;
      if (errs.length) { fail(`avatar ${k}=${v}: ${errs.join('; ')}`); avBad++; }
    }
  }
  if (!avBad) ok(`avatars: ${combos} part values, all well-formed`);
  for (const p of exp.AVATAR_PRESETS) {
    const errs = svgErrors(ctx.avatarSvg(p.avatar, { size: 52 }));
    if (errs.length) fail(`avatar preset "${p.name}": ${errs.join('; ')}`);
  }
  ok(`avatar presets: ${exp.AVATAR_PRESETS.length} all well-formed`);

  // The server clamps avatar parts to these counts; they must match the artwork.
  const declared = { bg: 8, skin: 6, hair: 9, hairColor: 8, eyes: 4, mouth: 4, facial: 3, acc: 4, shirt: 6 };
  for (const [k, n] of Object.entries(declared)) {
    if (!exp.AV[k]) fail(`AVATAR_PARTS has "${k}" but public/avatar.js does not`);
    else if (exp.AV[k].length !== n) fail(`AVATAR_PARTS says ${k}=${n} but public/avatar.js has ${exp.AV[k].length}`);
  }
  for (const k of Object.keys(exp.AV)) if (!(k in declared)) fail(`public/avatar.js has "${k}" but AVATAR_PARTS does not`);
  ok('avatar part counts match between lib/profile.js and public/avatar.js');
}

// ---------- 3. all client JavaScript parses ----------
{
  for (const f of ['public/avatar.js', 'public/art.js', 'public/common.js']) {
    try { new vm.Script(read(f), { filename: f }); ok(`${f} parses`); }
    catch (e) { fail(`${f}: ${e.message}`); }
  }
  for (const f of ['public/index.html', 'public/host.html', 'public/mentors.html']) {
    const html = read(f);
    const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    if (!blocks.length) { fail(`${f}: no inline script found`); continue; }
    const code = blocks.join('\n');
    try { new vm.Script(code, { filename: f }); ok(`${f} inline script parses`); }
    catch (e) { fail(`${f}: ${e.message}`); }
    // a page that draws art or avatars must actually load the script that defines them
    if (/categoryArt|medalArt/.test(code) && !/src="\/art\.js"/.test(html)) fail(`${f} uses the artwork helpers but does not load /art.js`);
    if (/avatarSvg/.test(code) && !/src="\/avatar\.js"/.test(html)) fail(`${f} uses avatarSvg but does not load /avatar.js`);
  }
}

// ---------- 4. mentor links ----------
{
  const eq = (label, got, want) => {
    if (JSON.stringify(got) === JSON.stringify(want)) return true;
    fail(`mentors ${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
    return false;
  };

  let a = parseMentors('Asha Patel | Cloud Architect at TCS | https://linkedin.com/in/asha');
  eq('full line', a.mentors, [{ name: 'Asha Patel', title: 'Cloud Architect at TCS', url: 'https://linkedin.com/in/asha' }]);
  eq('full line has no errors', a.errors, []);

  a = parseMentors('Ravi | https://linkedin.com/in/ravi');
  eq('name and link only', a.mentors, [{ name: 'Ravi', title: '', url: 'https://linkedin.com/in/ravi' }]);

  a = parseMentors('# a note\n\n\n   \nSam | https://example.com/sam');
  eq('blank lines and # comments skipped', a.mentors.length, 1);

  a = parseMentors('Jo | Lead | Dev | https://linkedin.com/in/jo');
  eq('extra pipes fold into the role', a.mentors[0].title, 'Lead Dev');

  a = parseMentors('No link here');
  eq('a line with no pipe is rejected', a.mentors, []);
  if (!a.errors.length) fail('mentors: a line with no | produced no error');

  a = parseMentors('Bad | linkedin.com/in/nope');
  eq('link without a scheme is rejected', a.mentors, []);
  if (!a.errors.length) fail('mentors: a scheme-less link produced no error');

  a = parseMentors('Evil | javascript:alert(1)');
  eq('javascript: link is rejected', a.mentors, []);

  a = parseMentors('Tag<script> | https://e.com/a');
  if (/[<>]/.test((a.mentors[0] || {}).name || '')) fail('mentors: angle brackets survived the name');

  const many = Array.from({ length: MAX_MENTORS + 5 }, (_, i) => `M${i} | https://e.com/${i}`).join('\n');
  a = parseMentors(many);
  eq(`capped at ${MAX_MENTORS}`, a.mentors.length, MAX_MENTORS);

  // the editor has to round-trip: stored list -> text -> same list
  const src = 'Asha | Cloud Architect at TCS | https://linkedin.com/in/asha\nRavi | https://linkedin.com/in/ravi';
  const once = parseMentors(src).mentors;
  eq('editor text round-trips', parseMentors(mentorsToText(once)).mentors, once);

  ok('mentor links: parsing, validation, escaping and round-trip all correct');
}

console.log(fails ? `\n${fails} check${fails === 1 ? '' : 's'} failed.` : '\nAll offline checks passed.');
process.exit(fails ? 1 : 0);
