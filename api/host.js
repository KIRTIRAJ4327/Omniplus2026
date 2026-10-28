import { route, readBody, requireHost, HttpError } from '../lib/http.js';
import { hostState, advance, newGame, kick, syncBank, clearWinners, resetUsage } from '../lib/game.js';
import { saveMentors } from '../lib/mentors.js';

export default route(['GET', 'POST'], async req => {
  requireHost(req);
  if (req.method === 'GET') { await syncBank(); return hostState(); }
  const b = readBody(req);
  switch (b.action) {
    case 'next': return advance(b.v);
    case 'new': return newGame(b.settings || {});
    case 'kick': return kick(b.playerId);
    case 'clearWinners': return clearWinners();
    case 'resetUsage': return resetUsage();
    case 'mentors': return saveMentors(b.text);
    default: throw new HttpError(400, 'Unknown action.');
  }
});
