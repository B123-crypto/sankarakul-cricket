# Cricket Live Score Backend

Backend for local limited-overs tournaments. One active admin (the director or
scorekeeper) manages teams and scores; spectators use public, read-only
endpoints and do not need accounts. Each match has two innings and a
director-selected limit of 1-100 overs per innings.

## Local setup

Use PostgreSQL and create a database/user for the app. Add these values to a
local `.env` file:

```text
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cricket_live_score
DB_USER=postgres
DB_PASSWORD=your-local-database-password
DB_SSL=false
JWT_SECRET=replace-with-a-random-secret-at-least-32-bytes-long
JWT_EXPIRES_IN=1d
ADMIN_SETUP_SECRET=replace-with-a-different-random-secret-at-least-32-bytes
```

Generate secret values with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `DB_SSL=true` when the PostgreSQL host requires TLS. Certificate
verification stays enabled unless the provider explicitly requires otherwise.

Apply migrations before starting the API:

```powershell
npm run db:migrate
npm run dev
npm test
```

Migrations in `src/migrations` are tracked in `app_schema_migrations` and are
not run automatically when the server starts. Migration 000 detects the older
legacy schema and replaces it only when its tables are empty; it stops without
changing data if any legacy table contains rows. Migration 003 enforces one
active admin; if the database already has multiple active admins, deactivate
the extras before migrating. Migration 004 converts the schema to
director-configured limited-overs matches (1-100 overs, no Test matches).
Migrations 005-007 add token revocation, boundary tracking, and separate extras
categories; migration 008 adds configurable bowler over limits, and migration
009 allows an inactive player's jersey number to be reused.

## Admin setup and access

Register the first scorekeeper once:

```http
POST /api/admin/register
x-admin-setup-secret: <ADMIN_SETUP_SECRET>
Content-Type: application/json

{"name":"Director","email":"director@example.com","password":"at-least-8-characters"}
```

Log in at `POST /api/admin/login`; send the returned JWT as
`Authorization: Bearer <token>` to all write endpoints under `/api/admin`.
Login is rate-limited. Spectator endpoints under `/api` are public and have no
write operations. Change the password with
`PATCH /api/admin/password` and
`{"currentPassword":"...","newPassword":"..."}`; this revokes existing tokens,
so log in again afterward.

## API

### Public spectator endpoints

- `GET /api/teams`
- `GET /api/teams/:id`
- `GET /api/teams/:teamId/players`
- `GET /api/matches?status=live`
- `GET /api/matches/:id?deliveryLimit=200` (limit: 1-500)

Match responses include innings totals, batting and bowling figures, extras,
and recent deliveries.

### Admin team and player management

- `POST /api/admin/teams` — `{ "name": "...", "shortName": "..." }`
- `PATCH /api/admin/teams/:id`
- `GET /api/admin/teams/:teamId/players?includeInactive=true`
- `POST /api/admin/teams/:teamId/players` — `{ "name": "...", "role": "batter", "jerseyNumber": 7 }`
- `PATCH /api/admin/players/:id` — update name, role, jersey number, or active status

Player roles are `batter`, `bowler`, `all_rounder`, and `wicket_keeper`.
Referenced teams and players are retained rather than deleted.

### Admin match and scoring operations

- `POST /api/admin/matches` — create a match with `homeTeamId`, `awayTeamId`,
  `oversPerInnings`, and optional `format`, `maxOversPerBowler`, `venue`,
  `scheduledAt`. If omitted, the bowler limit defaults to one-fifth of the
  innings overs, rounded up.
- `PATCH /api/admin/matches/:id` — edit a scheduled match.
- `POST /api/admin/matches/:id/start` — set `battingFirstTeamId`,
  `strikerId`, `nonStrikerId`, and `bowlerId`.
- `POST /api/admin/matches/:id/innings/2/start` — set the second-innings
  openers and bowler after the first innings is complete.
- `POST /api/admin/innings/:inningsId/deliveries` — record each delivery.
- `DELETE /api/admin/innings/:inningsId/deliveries/latest` — undo the latest
  delivery in that innings.
- `POST /api/admin/innings/:inningsId/complete` — end an innings early.
- `PATCH /api/admin/matches/:id/abandon` — abandon a scheduled or live match.

A delivery body includes `bowlerId`, `batterRuns`, `isBoundary`, an `extras`
object, `wicketType`, `dismissedPlayerId`, `nextStrikerId`, and
`nextNonStrikerId`.
Send an `extras` object with zero values when there are no extras. Use `null`
for `wicketType` and `dismissedPlayerId` when there is no wicket. Choose the
next striker and non-striker explicitly after each ball (after a wicket,
select the incoming batter; after the tenth wicket, both next-batter IDs are
`null`). This keeps strike changes under the local scorekeeper's control.
Example:

```json
{
  "bowlerId": "8",
  "batterRuns": 1,
  "isBoundary": false,
  "extras": {
    "wide": 0,
    "noBall": 0,
    "bye": 0,
    "legBye": 0,
    "penalty": 0
  },
  "wicketType": null,
  "dismissedPlayerId": null,
  "nextStrikerId": "5",
  "nextNonStrikerId": "4"
}
```

Set `isBoundary` only for an actual four or six; runs from overthrows can still
be recorded without counting as a boundary. Extras are tracked independently,
so a no-ball can also include byes or leg-byes. Wicket types are `bowled`,
`caught`, `lbw`, `run_out`, `stumped`, `hit_wicket`, `obstructing_field`, and
`hit_ball_twice`. Wides and no-balls do not count as legal balls; a bowler
cannot change part-way through an over.

Innings end at ten wickets, the configured over limit, a reached chase target,
or an admin's early-completion action. The match result is calculated from
both innings.

## Live updates

Spectators can subscribe over Socket.IO:

```js
socket.emit("match:join", "MATCH_ID", (result) => console.log(result));
socket.on("match:update", (match) => renderMatch(match));
socket.emit("match:leave", "MATCH_ID");
```

The server also emits `match:list:update` when match data changes. Socket
connections can join rooms and receive updates only; all scoring writes remain
authenticated HTTP requests.
