# Pulse Check

Live QR quiz for **Omni Pulse Tech 2026** (Oct 30, BCTI, Humber Polytechnic). Players scan one QR code, build an avatar profile, and play on their phones while the projector runs the show.

- **Profiles with avatars:** 9 traits (skin, hair incl. hijab and turban, glasses, headphones…), nickname, role and interest.
- **122-question bank** across 7 categories (AI, cyber, cloud, careers, Canadian tech, code and data, TCS). Each game draws the least-used questions and shuffles answer order, so repeat games stay fresh.
- **Fair timing:** every question shows alone for 3.5 seconds, then answers unlock on every phone at the same server-synced moment. Faster correct answers score more, with streak bonuses.
- **Networking breaks:** "Meet your match" pairs players with similar interests and shows each phone who to go find. Plus talk prompts.
- **Projector screen:** game setup, avatar wall lobby, heartbeat-line timer, auto-reveal when time is up or everyone answers, leaderboard and winners' podium.

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
4. **Settings → Environment Variables:** add `HOST_PIN`. Optional: `PUBLIC_URL` if you use a custom domain.
5. Redeploy. Open `https://<your-app>.vercel.app/host`, enter the PIN, pick categories, **Create game**.

Tables and the question bank are created automatically on first use.

## Run locally
```
npm install
DATABASE_URL=postgres://... HOST_PIN=1234 npm run dev     # http://localhost:3000 and /host
URL=http://localhost:3000 HOST_PIN=1234 N=150 npm test    # simulates 150 phones through a full game
```

## Edit questions
`lib/bank.js`. Add, edit or delete entries; they sync to the database the next time the host opens the host screen. Write the correct answer anywhere and set its index; 3–4 option questions are shuffled each game, 2-option ones (Fact/Fiction, Real/Scam) keep your order.

## Running the event
- Space or → advances. Questions reveal automatically.
- Leaderboard shows after each round. Final question is double points. Top 2 get the podium and a "come to the stage" screen on their phone.
- Click an avatar in the lobby to remove a player (deletes their profile).
- **Test on the BCTI Wi-Fi with 15+ real phones the day before.** Venue Wi-Fi is the usual failure point.
- Players who refresh or lose signal keep their profile and score.

## Limits
- One live game at a time (newest game is the live one). "Set up a new game" resets scores; profiles stay.
- Scoring: up to 1,000 per correct answer by speed, +100 per streak step (max +500), final doubled; ties go to faster total time.
