import { route, readBody } from '../lib/http.js';
import { answer } from '../lib/game.js';

export default route(['POST'], async req => answer(req.headers['x-player-token'], readBody(req)));
