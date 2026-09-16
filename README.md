# SkillBridge — Student Skill Matcher

SkillBridge is a hackathon-ready student-to-opportunity matching platform for SDG 8. The local development mode runs with deterministic matching/parsing and an in-memory database when MongoDB is not configured. Production mode requires Firebase Admin credentials and MongoDB; it does not trust client role headers or fall back to memory storage.

## Local development

```powershell
npm install
npm start
```

Open `http://localhost:4000`.

`npm start` explicitly enables development-only local authentication and the in-memory database. Data resets when the server stops unless `MONGODB_URI` is configured.

## Development checks

```powershell
npm test
npm run check
```

`npm run check` includes matcher tests, API authorization/privacy integration tests, frontend smoke checks, and JavaScript syntax validation.

## Production configuration

Use:

```text
NODE_ENV=production
LOCAL_AUTH=false
FRONTEND_URL=https://your-frontend.example
MONGODB_URI=your-mongodb-uri
MONGODB_DB_NAME=skillbridge
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

Production startup fails when Firebase Admin credentials or MongoDB are unavailable. Organization access is derived from the authenticated Firebase identity and a verified organization record. Candidate discovery is limited to explicitly opted-in profiles.

## Matching model

The canonical matcher is `server/matcher.js`. It combines exact and related skill overlap, skill confidence, evidence, role fit, interest, experience, work mode, education, location, semantic similarity, and bounded personalization. `server/matcher-v2.js` is intentionally removed so there is one scoring system.
