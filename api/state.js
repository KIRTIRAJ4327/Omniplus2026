import { route, send } from '../lib/http.js';
import { publicState } from '../lib/game.js';

// Everyone gets the same public state, so Vercel's edge caches it for 1 second.
// 300 phones polling = about one function call per second.
export default route(['GET'], async (req, res) => {
  send(res, 200, await publicState(), 'public, max-age=0, s-maxage=1');
});
