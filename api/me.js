import { route } from '../lib/http.js';
import { me } from '../lib/game.js';

export default route(['GET'], async req => me(req.headers['x-player-token']));
