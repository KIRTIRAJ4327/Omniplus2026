import crypto from 'node:crypto';
import { db } from './db.js';
import { HttpError } from './http.js';

// Must match AVATAR_PARTS in public/avatar.js
export const AVATAR_PARTS = { bg: 8, skin: 6, hair: 9, hairColor: 8, eyes: 4, mouth: 4, facial: 3, acc: 4, shirt: 6 };
export const ROLES = { student: 'Student', jobseeker: 'Job seeker', pro: 'Working in tech' };
export const INTERESTS = { ai: 'AI', cyber: 'Cybersecurity', cloud: 'Cloud', data: 'Data', dev: 'Software dev', design: 'Design and product' };

const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'nazi', 'porn', 'cock', 'whore', 'slut', 'nigg', 'fag', 'rape', 'hitler'];

export function cleanName(raw) {
  const n = String(raw || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
  if (n.length < 2) throw new HttpError(400, 'Pick a nickname of 2 to 18 characters.');
  const leet = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '$': 's', '@': 'a', '!': 'i' };
  const flat = n.toLowerCase().replace(/[0134578$@!]/g, ch => leet[ch] || ch).replace(/[^a-z]/g, '');
  if (BLOCKED.some(w => flat.includes(w))) throw new HttpError(400, 'Pick a different nickname. It goes on the big screen.');
  return n;
}

export function cleanAvatar(a) {
  const out = {};
  for (const [k, n] of Object.entries(AVATAR_PARTS)) {
    const v = Number(a && a[k]);
    out[k] = Number.isInteger(v) && v >= 0 && v < n ? v : 0;
  }
  return out;
}

const pick = (v, map) => (Object.hasOwn(map, v) ? v : '');

export async function createProfile(body) {
  const sql = db();
  const nickname = cleanName(body.nickname);
  const token = crypto.randomBytes(24).toString('base64url');
  try {
    const [p] = await sql`
      insert into pc_players (token, nickname, avatar, role, interest)
      values (${token}, ${nickname}, ${sql.json(cleanAvatar(body.avatar))}, ${pick(body.role, ROLES)}, ${pick(body.interest, INTERESTS)})
      returning id, nickname, avatar, role, interest`;
    return { token, profile: p };
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'That nickname is taken. Try another.');
    throw e;
  }
}

export async function updateProfile(token, body) {
  const sql = db();
  const p = await playerByToken(token);
  const nickname = body.nickname !== undefined ? cleanName(body.nickname) : p.nickname;
  try {
    const [u] = await sql`
      update pc_players set nickname = ${nickname},
        avatar = ${sql.json(body.avatar ? cleanAvatar(body.avatar) : p.avatar)},
        role = ${body.role !== undefined ? pick(body.role, ROLES) : p.role},
        interest = ${body.interest !== undefined ? pick(body.interest, INTERESTS) : p.interest}
      where id = ${p.id}
      returning id, nickname, avatar, role, interest`;
    return { profile: u };
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'That nickname is taken. Try another.');
    throw e;
  }
}

export async function playerByToken(token) {
  if (!token || typeof token !== 'string' || token.length > 64) throw new HttpError(401, 'Create a profile to play.', { code: 'no_profile' });
  const [p] = await db()`select id, nickname, avatar, role, interest from pc_players where token = ${token}`;
  if (!p) throw new HttpError(401, 'Create a profile to play.', { code: 'no_profile' });
  return p;
}
