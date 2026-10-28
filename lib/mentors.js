// Mentor links, edited from the host screen and shown to players at /mentors.
// Stored as one JSON array in pc_meta, because there are a dozen or so of them and
// they are rewritten as a whole list rather than edited row by row.
// The parsing and validation lives in mentor-text.js, which has no database import.
import { db } from './db.js';
import { HttpError } from './http.js';
import { parseMentors, cleanMentors } from './mentor-text.js';

export { parseMentors, mentorsToText, MAX_MENTORS } from './mentor-text.js';

export async function getMentors(sql = db()) {
  const [row] = await sql`select value from pc_meta where key = 'mentors'`;
  return cleanMentors(row?.value);
}

export async function saveMentors(text) {
  const { mentors, errors } = parseMentors(text);
  // Nothing usable at all is a mistake worth stopping on; a mix of good and bad
  // lines saves the good ones and reports the rest.
  if (errors.length && !mentors.length) throw new HttpError(400, errors[0], { errors });
  const sql = db();
  await sql`
    insert into pc_meta (key, value) values ('mentors', ${sql.json(mentors)})
    on conflict (key) do update set value = excluded.value`;
  return { ok: true, saved: mentors.length, mentors, errors };
}
