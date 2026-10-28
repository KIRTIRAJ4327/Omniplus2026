// The Linktree (or any) URL for the networking screen at the end of the game.
// Unset means the networking panel stays hidden, so the link can be added later by
// setting NETWORK_URL in Vercel and redeploying. No code change needed.
export function networkUrl() {
  const u = String(process.env.NETWORK_URL || '').trim();
  return /^https?:\/\/\S+$/.test(u) ? u : '';
}
