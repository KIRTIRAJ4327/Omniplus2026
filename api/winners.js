import { route, send } from '../lib/http.js';
import { winners } from '../lib/game.js';

// Public list of everyone who has placed in a game, newest game first.
// `names` is the flat list for the other activity to read; `winners` has the detail.
export default route(['GET'], async (req, res) => {
  send(res, 200, await winners(), 'public, max-age=0, s-maxage=5');
});
