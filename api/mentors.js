import { route, send } from '../lib/http.js';
import { getMentors } from '../lib/mentors.js';

// Public mentor list, for the /mentors page players land on after scanning.
export default route(['GET'], async (req, res) => {
  send(res, 200, { mentors: await getMentors() }, 'public, max-age=0, s-maxage=10');
});
