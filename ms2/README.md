# Lost & Found — Backend API

Production-quality Node.js/Express/Prisma backend for a Lost & Found web platform. Designed for a college campus pilot, extensible to apartment societies, offices, and transit operators.

---

## Features

- 🔐 **Passwordless email OTP auth** with rotating refresh tokens & reuse detection
- 📦 **LOST / FOUND item listings** with full-text search (pg_trgm), geo filtering (Haversine), and lifecycle management
- 🔍 **Rules-based auto-matching** (Jaccard trigram + distance + date) behind a `MatchStrategy` interface (swap in pgvector/CLIP later)
- 🤝 **Claims + verification** — server-side answer comparison; answer never returned to clients
- 💬 **Real-time chat** via Socket.io, scoped to claims, with contact-info warnings
- 🔔 **Notifications** — persisted, real-time pushed, optionally emailed
- 🛡️ **Admin moderation** — reports, item approval/rejection, user ban/unban, platform stats
- 📷 **Cloudinary** signed direct uploads — no file bytes pass through our server
- 📧 **Resend mailer** with console fallback (no API key needed in dev)
- ⏱️ **Cron jobs** — expireItems, matchingSweep, cleanupOtps (all idempotent)
- 📚 **Swagger UI** at `/docs`
- ✅ **Vitest + Supertest** integration tests

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker (for Postgres via pgvector)

### 1. Clone and install

```bash
cd ms2
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
# Generate secrets: openssl rand -hex 32
```

### 3. Start Postgres

```bash
docker compose up db -d
```

### 4. Run migrations and seed

```bash
npm run db:migrate    # Creates tables + pg_trgm extension
npm run db:seed       # Seeds categories, handover points, admin user, sample items
```

### 5. Start dev server

```bash
npm run dev
```

The server starts at `http://localhost:4000`.

- **Health**: `GET http://localhost:4000/health`
- **API base**: `http://localhost:4000/api/v1`
- **Docs**: `http://localhost:4000/docs`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | — | Secret for access token signing (≥16 chars) |
| `JWT_REFRESH_SECRET` | ✅ | — | Secret for refresh token signing (≥16 chars) |
| `PORT` | ❌ | `4000` | HTTP port |
| `NODE_ENV` | ❌ | `development` | `development` / `production` / `test` |
| `CORS_ORIGINS` | ❌ | `http://localhost:5173` | Comma-separated allowed origins |
| `ACCESS_TOKEN_TTL` | ❌ | `15m` | JWT access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | ❌ | `14` | Refresh token lifetime in days |
| `ALLOWED_EMAIL_DOMAINS` | ❌ | `` | Comma-separated domains (empty = allow all) |
| `REQUIRE_MODERATION` | ❌ | `false` | New items start as `PENDING_REVIEW` |
| `ITEM_EXPIRY_DAYS` | ❌ | `60` | Days before active items expire |
| `RESEND_API_KEY` | ❌ | — | Resend API key (absent = console mailer) |
| `MAIL_FROM` | ❌ | `Lost & Found <noreply@lostfound.local>` | Sender address |
| `CLOUDINARY_CLOUD_NAME` | ❌ | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ❌ | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ❌ | — | Cloudinary API secret |
| `MATCH_RADIUS_KM` | ❌ | `2` | Geo radius for matching |
| `MATCH_DAYS_WINDOW` | ❌ | `14` | Date window (days) for matching |
| `MATCH_MIN_SCORE` | ❌ | `0.45` | Minimum match score to store (0–1) |

---

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start production server from `dist/` |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:deploy` | Run Prisma migrations (production) |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset DB and re-migrate (dev only) |
| `npm test` | Run Vitest integration tests |
| `npm run lint` | ESLint |
| `npm run format` | Prettier format |

---

## Folder Structure

```
src/
├── config/          # env.ts (Zod-validated), constants.ts
├── lib/             # prisma.ts, logger.ts, mailer.ts, cloudinary.ts, socket.ts, notifications.ts
├── middleware/      # auth.ts, requireRole.ts, validate.ts, rateLimiters.ts, errorHandler.ts
├── modules/
│   ├── auth/        # OTP flow, JWT, refresh, logout, me
│   ├── users/       # me/items, me/claims
│   ├── categories/  # public list
│   ├── items/       # CRUD, search, geo, mark-returned
│   ├── uploads/     # Cloudinary sign endpoint
│   ├── claims/      # submit, approve/reject, cancel
│   ├── messages/    # claim-scoped chat
│   ├── matches/     # auto-matching, dismiss
│   ├── notifications/ # list, read, count
│   ├── reports/     # submit report
│   ├── handover-points/ # public list + admin CRUD
│   └── admin/       # moderation, ban, stats
├── jobs/            # expireItems.ts, matchingSweep.ts, cleanupOtps.ts
├── openapi/         # swagger.json + spec.ts setup
├── utils/           # ApiError, asyncHandler, pagination, normalise, geo, contactMask
├── app.ts           # Express app factory
└── server.ts        # HTTP server + Socket.io + cron bootstrap
tests/
├── setup.ts         # DB lifecycle + helpers
├── auth.test.ts
├── items.test.ts
├── claims.test.ts
└── notifications.test.ts
```

---

## API Conventions

- Base path: `/api/v1`
- JSON only (`Content-Type: application/json`)
- Auth: `Authorization: Bearer <accessToken>`
- List responses: `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`
- Single responses: `{ "data": { ... } }`
- Errors: `{ "error": { "code": "STRING", "message": "...", "details": [] } }`
- Dates: ISO 8601 UTC
- IDs: UUIDs

See `http://localhost:4000/docs` for the full interactive spec.

---

## Socket.io Events

Connect with `{ auth: { token: '<accessToken>' } }`.

| Event | Direction | Description |
|---|---|---|
| `claim:join` (emit) | Client → Server | Join a claim room |
| `message:new` | Server → Client | New chat message in a claim room |
| `claim:updated` | Server → Client | Claim status changed |
| `notification:new` | Server → Client | New notification pushed to user room |

---

## Deployment

### Render + Supabase (free tier)

1. Create a Supabase project — copy the `DATABASE_URL` (pooler connection string)
2. Enable `pg_trgm` in Supabase: SQL Editor → `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
3. Push to GitHub
4. Create a new **Web Service** on Render:
   - **Build command**: `npm ci && npm run build`
   - **Start command**: `npm run db:deploy && node dist/server.js`
   - Set all env vars from `.env.example`
5. Deploy ✅

### Railway (free tier)

1. Connect your GitHub repo
2. Add a PostgreSQL plugin
3. Copy `DATABASE_URL` from the plugin to env vars
4. Set **Start command**: `npm run db:deploy && node dist/server.js`
5. Add remaining env vars

### Docker Compose (self-hosted)

```bash
# Build and start everything
docker compose up --build -d

# First time: run migrations and seed
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run db:seed
```

---

## Security Notes

- Verification answers are **never** returned in any API response
- OTP codes are stored as SHA-256 hashes only
- Refresh tokens are stored as SHA-256 hashes only; reuse triggers revocation of all tokens for that user
- User emails/phones are never exposed in public item or chat responses
- All write endpoints are Zod-validated; HTML is stripped from user text inputs
- Rate limiting: global (200/15min/IP), OTP requests (3/15min/IP), upload signatures (20/10min/user)

---

## Assumptions

1. `pg_trgm` is available (pre-installed in pgvector docker image and Supabase)
2. `pgvector` is available but the embedding column is unused until a CLIP integration is added
3. Cloudinary is optional — image URLs are still accepted without validation when `CLOUDINARY_CLOUD_NAME` is unset
4. Resend is optional — a console mailer is used in dev
5. Swagger UI package (`swagger-ui-express`) is an optional dev dependency; add it with `npm i swagger-ui-express @types/swagger-ui-express` when needed
6. The frontend is built separately; this API is frontend-agnostic
