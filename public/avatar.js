// Original SVG avatars. Part counts must match AVATAR_PARTS in lib/profile.js.
const AV = {
  bg: ['#FFD6A5', '#CDEAC0', '#BDE0FE', '#FFC8DD', '#E2D4F0', '#FDE68A', '#B9F3E4', '#FFB4A2'],
  skin: ['#F9DCC4', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#5C3A21'],
  hair: ['None', 'Short', 'Side part', 'Curly', 'Long', 'Bun', 'Mohawk', 'Hijab', 'Turban'],
  hairColor: ['#1F1B24', '#4A2C1D', '#8B5A2B', '#D4A15A', '#B5523B', '#9AA0A6', '#2F6FDE', '#E23D4B'],
  eyes: ['Dots', 'Happy', 'Wink', 'Wide'],
  mouth: ['Smile', 'Grin', 'Calm', 'Wow'],
  facial: ['None', 'Beard', 'Moustache'],
  acc: ['None', 'Glasses', 'Shades', 'Headphones'],
  shirt: ['#1B2A4E', '#E23D4B', '#2F6FDE', '#F2A900', '#1E9E6A', '#F5F5F5']
};
const AVATAR_PARTS = Object.fromEntries(Object.entries(AV).map(([k, v]) => [k, v.length]));
const INK = '#17121D';

function randomAvatar() {
  const r = n => Math.floor(Math.random() * n);
  const a = {};
  for (const [k, n] of Object.entries(AVATAR_PARTS)) a[k] = r(n);
  if (Math.random() < 0.55) a.facial = 0;
  if (Math.random() < 0.5) a.acc = 0;
  return a;
}

let avatarUid = 0;
function avatarSvg(cfg, opts = {}) {
  const c = Object.assign({ bg: 0, skin: 0, hair: 1, hairColor: 0, eyes: 0, mouth: 0, facial: 0, acc: 0, shirt: 0 }, cfg || {});
  const g = (k) => AV[k][c[k]] ?? AV[k][0];
  const skin = g('skin'), hairC = g('hairColor'), shirt = g('shirt');
  const id = 'av' + (++avatarUid);
  const covered = c.hair === 7; // hijab hides ears, neck and hair
  const parts = [];

  parts.push(`<rect width="120" height="120" fill="${g('bg')}"/>`);
  // back hair
  if (c.hair === 4) parts.push(`<path d="M33 54Q33 25 60 25Q87 25 87 54L90 98Q60 108 30 98Z" fill="${hairC}"/>`);
  // body
  if (!covered) parts.push(`<rect x="52" y="72" width="16" height="16" rx="4" fill="${skin}"/>`);
  parts.push(`<path d="M20 124Q20 92 60 87Q100 92 100 124Z" fill="${shirt}"/>`);
  if (c.shirt === 5) parts.push(`<path d="M20 124Q20 92 60 87Q100 92 100 124" fill="none" stroke="#C9D2E0" stroke-width="2"/>`);
  parts.push(`<path d="M52 89Q60 97 68 89" fill="none" stroke="${INK}" stroke-opacity=".18" stroke-width="2"/>`);
  if (covered) {
    parts.push(`<path d="M30 60Q29 24 60 24Q91 24 90 60L95 104Q60 116 25 104Z" fill="${hairC}"/>`);
    parts.push(`<ellipse cx="60" cy="58" rx="20" ry="23" fill="${skin}"/>`);
  } else {
    parts.push(`<circle cx="36" cy="59" r="5" fill="${skin}"/><circle cx="84" cy="59" r="5" fill="${skin}"/>`);
    parts.push(`<circle cx="60" cy="56" r="24" fill="${skin}"/>`);
  }
  // facial hair
  if (c.facial === 1) parts.push(`<path d="M37 60Q39 85 60 87Q81 85 83 60Q79 75 70 76Q60 72 50 76Q41 75 37 60Z" fill="${hairC}"/>`);
  if (c.facial === 2) parts.push(`<path d="M50 67Q55 62 60 65Q65 62 70 67Q65 66 60 68Q55 66 50 67Z" fill="${hairC}" stroke="${hairC}" stroke-width="2" stroke-linejoin="round"/>`);
  // cheeks
  parts.push(`<circle cx="45" cy="65" r="4" fill="#FF6B81" opacity=".22"/><circle cx="75" cy="65" r="4" fill="#FF6B81" opacity=".22"/>`);
  // eyes
  const eye = (x, kind) => {
    if (kind === 'dot') return `<circle cx="${x}" cy="57" r="2.8" fill="${INK}"/>`;
    if (kind === 'arc') return `<path d="M${x - 4} 58.5Q${x} 53 ${x + 4} 58.5" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
    return `<circle cx="${x}" cy="57" r="4.6" fill="#fff"/><circle cx="${x + 0.6}" cy="57.6" r="2.3" fill="${INK}"/>`;
  };
  const E = c.eyes;
  parts.push(E === 0 ? eye(51, 'dot') + eye(69, 'dot') : E === 1 ? eye(51, 'arc') + eye(69, 'arc') : E === 2 ? eye(51, 'dot') + eye(69, 'arc') : eye(51, 'wide') + eye(69, 'wide'));
  // mouth
  const M = c.mouth;
  if (M === 0) parts.push(`<path d="M52 67Q60 74 68 67" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`);
  if (M === 1) parts.push(`<path d="M50 66Q60 79 70 66Z" fill="#7A2E3A"/><path d="M52 66.5L68 66.5L66.5 69Q60 70 53.5 69Z" fill="#fff"/>`);
  if (M === 2) parts.push(`<path d="M53 69L67 69" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`);
  if (M === 3) parts.push(`<ellipse cx="60" cy="69" rx="3.4" ry="4.2" fill="#7A2E3A"/>`);
  // front hair
  const H = c.hair;
  if (H === 1 || H === 4 || H === 5) parts.push(`<path d="M35 52Q34 29 60 29Q86 29 85 52Q81 38 60 37Q41 38 35 52Z" fill="${hairC}"/>`);
  if (H === 2) parts.push(`<path d="M35 54Q33 28 62 28Q87 29 85 51Q78 36 57 40Q44 43 35 54Z" fill="${hairC}"/>`);
  if (H === 3) {
    let s = '';
    for (let k = 0; k <= 8; k++) {
      const t = Math.PI * (0.95 - k * 0.1125);
      s += `<circle cx="${(60 + 23 * Math.cos(t)).toFixed(1)}" cy="${(51 - 21 * Math.sin(t)).toFixed(1)}" r="8.5" fill="${hairC}"/>`;
    }
    parts.push(s);
  }
  if (H === 5) parts.push(`<circle cx="60" cy="24" r="9" fill="${hairC}"/>`);
  if (H === 6) parts.push(`<path d="M54 44Q53 17 60 14Q67 17 66 44Q63 40 60 40Q57 40 54 44Z" fill="${hairC}"/>`);
  if (H === 8) {
    parts.push(`<path d="M33 50Q32 22 60 20Q88 22 87 50Q75 40 60 41Q45 40 33 50Z" fill="${hairC}"/>`);
    parts.push(`<path d="M38 40Q60 26 82 40M42 32Q60 22 78 33" fill="none" stroke="${INK}" stroke-opacity=".22" stroke-width="2"/>`);
  }
  // accessories
  const A = c.acc;
  if (A === 1) parts.push(`<g fill="none" stroke="${INK}" stroke-width="2"><circle cx="51" cy="57" r="7"/><circle cx="69" cy="57" r="7"/><path d="M58 57h4M44 56l-7-2M76 56l7-2"/></g>`);
  if (A === 2) parts.push(`<g fill="${INK}"><rect x="42" y="52" width="16" height="10" rx="4"/><rect x="62" y="52" width="16" height="10" rx="4"/><rect x="57" y="54" width="6" height="2"/></g>`);
  if (A === 3) parts.push(`<path d="M31 60Q31 23 60 23Q89 23 89 60" fill="none" stroke="${INK}" stroke-width="5"/><rect x="26" y="52" width="10" height="17" rx="4" fill="#FF4D6D"/><rect x="84" y="52" width="10" height="17" rx="4" fill="#FF4D6D"/>`);

  const size = opts.size || 64;
  const label = opts.label ? ` role="img" aria-label="${String(opts.label).replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 120 120"${label}><defs><clipPath id="${id}"><circle cx="60" cy="60" r="60"/></clipPath></defs><g clip-path="url(#${id})">${parts.join('')}</g></svg>`;
}
