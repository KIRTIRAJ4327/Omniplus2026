import { route, readBody } from '../lib/http.js';
import { createProfile, updateProfile, ROLES, INTERESTS, AVATAR_PARTS } from '../lib/profile.js';

export default route(['GET', 'POST'], async req => {
  if (req.method === 'GET') return { roles: ROLES, interests: INTERESTS, parts: AVATAR_PARTS };
  const body = readBody(req);
  const token = req.headers['x-player-token'];
  return token ? updateProfile(token, body) : createProfile(body);
});
