# Pulse Check

Live QR quiz for **Omni Pulse Tech 2026** (Oct 30, BCTI, Humber Polytechnic). Players scan one QR code, build an avatar profile, and play on their phones while the projector runs the show.

- **Profiles with avatars:** 9 traits (skin, hair incl. hijab and turban, glasses, headphones…), nickname, role and interest.
- **122-question bank** across 7 categories (AI, cyber, cloud, careers, Canadian tech, code and data, TCS). The host picks how many questions to ask and how often the leaderboard interrupts; questions are drawn at random across the chosen categories, evenly and least-used first, with answer order shuffled, so repeat games stay fresh.
- **Fair timing:** every question shows alone for 3.5 seconds, then answers unlock on every phone at the same server-synced moment. Faster correct answers score more, with streak bonuses.
- **Networking breaks:** "Meet your match" pairs players with similar interests and shows each phone who to go find. Plus talk prompts.
- **Projector screen:** game setup, avatar wall lobby, heartbeat-line timer, auto-reveal when time is up or everyone answers, leaderboard and a three-place winners' podium.
- **Winners list:** the top 3 of every finished game is saved automatically and served at `/api/winners`, so another activity can read the names. The host screen shows the running list with a copy button.
- **Networking finish:** add your mentors' LinkedIn links from the host screen. The final screen shows a QR to a `/mentors` page, and every player's phone gets a button to the same place - one scan, then one tap per mentor.
- **Category artwork:** every question is labelled with a monoline illustration of its category, drawn in the same stroke as the heartbeat timer. All inline SVG, so nothing extra is fetched on venue Wi-Fi.

## Stack
Static pages + Vercel serverless functions (`/api`) + Postgres. No WebSockets: phones poll a public state endpoint that Vercel's edge caches for 1 second, so hundreds of phones cost roughly one function call per second.

## Deploy (about 10 minutes)

**Option A: script** (needs `gh` and `vercel` CLIs, logged in)
```
./scripts/deploy.sh
```

**Option B: by hand**
1. Push this folder to a new GitHub repo.
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: **Other**. No build command.
3. **Storage → Create Database → Neon → Connect** to the project. This sets `DATABASE_URL`.
   Using Supabase instead? Set `DATABASE_URL` to its **Transaction pooler** string (port 6543).
4. **Settings → Environment Variables:** add `HOST_PIN`. Optional: `PUBLIC_URL` if you
   use a custom domain, and `NETWORK_URL` as a fallback networking link (see below -
   mentor links entered on the host screen are the better option and need no env var).
5. Redeploy. Open `https://<your-app>.vercel.app/host`, enter the PIN, pick categories, **Create game**.

Tables and the question bank are created automatically on first use.

## Run locally
```
npm install
npm run check                                             # offline: question bank, artwork, client JS. No database needed.
DATABASE_URL=postgres://... HOST_PIN=1234 npm run dev     # http://localhost:3000 and /host
URL=http://localhost:3000 HOST_PIN=1234 N=150 npm test    # simulates 150 phones through a full game
```

`npm run check` needs nothing but Node, so run it after any edit to `lib/bank.js`,
`public/art.js` or `public/avatar.js`.

## Edit questions
`lib/bank.js`. Add, edit or delete entries; they sync to the database the next time the host opens the host screen. Write the correct answer anywhere and set its index; 3–4 option questions are shuffled each game, 2-option ones (Fact/Fiction, Real/Scam) keep your order.

Run `npm run check` afterwards — it catches a duplicate question, an answer index out
of range, a missing fact and anything else that would only show up on the projector.

## Running the event
- Space or → advances. Questions reveal automatically.
- Leaderboard shows every few questions, as often as you set on the setup screen. Final question is double points. Top 3 get the podium and a "come to the stage" screen on their phone.
- **F** toggles full screen. **N** toggles the full-screen networking QR, for after the podium while people are standing up.
- **Menu → Winners list** shows every saved winner, with a button to copy the names.
- **Menu → Mentor links** is where the networking links go. Fill it in before the event.
- Click an avatar in the lobby to remove a player (deletes their profile).
- **Test on the BCTI Wi-Fi with 15+ real phones the day before.** Venue Wi-Fi is the usual failure point.
- After your rehearsals, use **Menu → Mark all questions unused** so the real game draws from the whole bank again.
- Players who refresh or lose signal keep their profile and score.

## Networking at the end
Twelve to fifteen mentors is too many for one link, so the host screen keeps the list
and players get a page they can tap through.

1. On the host screen: **Menu → Mentor links**.
2. Paste one mentor per line, then **Save links**:
   ```
   Asha Patel | Cloud Architect | TCS | https://linkedin.com/in/example
   Ravi Singh | Security Lead | https://linkedin.com/in/example2
   # Name | Job Title | Company | Link. Title and company are optional,
   # and a link copied without https:// (linkedin.com/in/...) is fine.
   ```
   Each company gets a coloured monogram badge (TCS, CDW, BM...) on the mentor
   cards and in an "In the room today" strip. These stand in for logos: real logo
   images would have to load over venue Wi-Fi, which the app avoids everywhere.
3. That's it. The final screen shows a QR to `/mentors`, and so does **N** at any time.
   Every player's phone gets a **Meet the mentors** button on their final screen.

You can edit the list mid-event; players see the change on their next page load, so
it is fine to add the links while the quiz is running. Only `http://` and `https://`
links are accepted, and names are stripped of markup before they reach any phone.

If you would rather use a single Linktree, set `NETWORK_URL` instead and leave the
mentor list empty. Mentor links win when both are set. With neither, the networking
panel simply doesn't appear.

Players can also reach the list directly at `/mentors`, and `GET /api/mentors`
returns it as JSON.

## The winners list
The top 3 of a game is saved the moment the game reaches its final screen. Nothing
is saved if you abandon a game before then, so press through to the podium. The host
screen warns you if you set up a new game while one is still mid-flight.

```
GET /api/winners
{
  "count": 6,
  "names": ["Priya from Humber", "Dev", "Sam"],
  "winners": [
    { "place": 1, "name": "Priya from Humber", "avatar": {...}, "score": 8420, "correct": 11,
      "recorded_at": "2026-10-30T23:12:04.118Z", "game_id": "..." }
  ]
}
```

`names` is the flat, de-duplicated list, newest game first — that is the one to read
from another activity. `winners` has a row per place with the score and avatar.
The list survives new games, score resets and players being removed. Clear it from
**Menu → Winners list → Clear list**.

## Limits
- One live game at a time (newest game is the live one). "Set up a new game" resets scores; profiles stay.
- Questions per game: 4 to 60, and 3 to 10 between leaderboards. Both are set on the
  setup screen. If the chosen categories hold fewer than you ask for, the game asks
  what is there and the setup screen says so before you start.
- Scoring: up to 1,000 per correct answer by speed, +100 per streak step (max +500), final doubled; ties go to faster total time.
- Nicknames are unique across the whole database and profiles are kept between games, so a name used in a rehearsal stays taken.
