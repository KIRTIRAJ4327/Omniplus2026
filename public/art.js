// Category artwork. Every piece is monoline, drawn in the same stroke weight and
// round caps as the ECG timer line, sitting on a baseline at y=62 so it reads as a
// segment of the same heartbeat trace. One accent detail per piece, in --pulse.
// Two tones only, no images, no network requests.

const BASE = '<path class="ln base-ln" pathLength="100" d="M2 62H118"/>';

const ART = {
  // A neural net: five nodes wired to one bright one.
  ai: `${BASE}
    <path class="ln" pathLength="100" d="M44 32 60 22 76 32M44 32 52 48M76 32 68 48M52 48H68M60 22V48"/>
    <circle class="ln" cx="44" cy="32" r="3.2"/><circle class="ln" cx="76" cy="32" r="3.2"/>
    <circle class="ln" cx="52" cy="48" r="3.2"/><circle class="ln" cx="68" cy="48" r="3.2"/>
    <circle class="accent" cx="60" cy="22" r="5"/>`,

  // A padlock, keyhole lit up.
  cyber: `${BASE}
    <rect class="ln" pathLength="100" x="45" y="34" width="30" height="24" rx="5"/>
    <path class="ln" pathLength="100" d="M52 34v-7a8 8 0 0 1 16 0v7"/>
    <circle class="accent" cx="60" cy="43" r="3.4"/>
    <path class="accent-ln" d="M60 46.5v6"/>`,

  // A cloud with something on its way up into it.
  cloud: `${BASE}
    <path class="ln" pathLength="100" d="M46 44a8 8 0 0 1 1-15.8A12 12 0 0 1 69 25a8 8 0 0 1 3 19Z"/>
    <path class="accent-ln" d="M60 58V48m-5 4.5 5-5 5 5"/>`,

  // A briefcase, with the trajectory everyone is here for.
  careers: `${BASE}
    <rect class="ln" pathLength="100" x="43" y="36" width="34" height="22" rx="4"/>
    <path class="ln" pathLength="100" d="M53 36v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M43 45h34"/>
    <path class="accent-ln" d="M46 25l7-5 6 4 9-7m0 0h-5m5 0v5"/>`,

  // The CN Tower, beacon on.
  canada: `${BASE}
    <path class="ln" pathLength="100" d="M56 58 57.6 38h4.8L64 58M50 38h20l-3.5-6h-13Z"/>
    <path class="ln" pathLength="100" d="M60 32V20"/>
    <path class="ln" pathLength="100" d="M53 58h14"/>
    <circle class="accent" cx="60" cy="17" r="4"/>`,

  // Angle brackets and the slash between them.
  dev: `${BASE}
    <path class="ln" pathLength="100" d="M48 28 34 43l14 15"/>
    <path class="ln" pathLength="100" d="M72 28l14 15-14 15"/>
    <path class="accent-ln" d="M66 25 54 61"/>`,

  // An enterprise network: six nodes around one centre.
  tcs: `${BASE}
    <path class="ln" pathLength="100" d="M60 18 77 28v20L60 58 43 48V28Z"/>
    <path class="ln" pathLength="100" d="M60 38 60 18M60 38 77 48M60 38 43 48"/>
    <circle class="ln" cx="77" cy="28" r="2.8"/><circle class="ln" cx="43" cy="28" r="2.8"/>
    <circle class="ln" cx="77" cy="48" r="2.8"/><circle class="ln" cx="43" cy="48" r="2.8"/>
    <circle class="ln" cx="60" cy="58" r="2.8"/>
    <circle class="accent" cx="60" cy="38" r="5"/>`
};

// A heartbeat spike, for categories we don't have art for yet.
const FALLBACK = `${BASE}
  <path class="ln" pathLength="100" d="M34 62h10l5-8 6 12 7-34 7 40 5-10h12"/>
  <circle class="accent" cx="60" cy="24" r="4"/>`;

function categoryArt(cat, { width = 120, draw = true, label = '' } = {}) {
  const body = ART[cat] || FALLBACK;
  const a11y = label ? ` role="img" aria-label="${String(label).replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
  return `<svg class="art${draw ? ' draw' : ''}" viewBox="0 0 120 72" width="${width}" height="${Math.round(width * 0.6)}"${a11y}>${body}</svg>`;
}

// Podium rosette. The ribbon tails only show on first place.
function medalArt(place, size = 56) {
  const tails = place === 1 ? '<path class="ln" pathLength="100" d="M22 38 16 54l10-3 4 9 6-14M42 38l6 16-10-3-4 9-6-14"/>' : '';
  return `<svg class="art medal" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
    ${tails}<circle class="ln" cx="32" cy="24" r="16"/>
    <text class="medal-n" x="32" y="24" text-anchor="middle" dominant-baseline="central">${place}</text>
  </svg>`;
}
