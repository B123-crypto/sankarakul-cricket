# Boundary frontend

React, TypeScript, Vite, Tailwind CSS, and TanStack Query client for the local
cricket backend.

## Run locally

In PowerShell:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

The default API URL is `http://localhost:5000`. Set `VITE_API_BASE_URL` in
`.env.local` when the backend is hosted elsewhere. For a physical phone, use
the computer's reachable LAN address instead of `localhost`. Production builds
use the same origin unless `VITE_API_BASE_URL` is configured.

## Verify and build

```powershell
npm run lint
npm run build
```

Spectators can browse matches and open scorecards without an account. Live
match details subscribe to the backend's Socket.IO `match:join` and
`match:update` events and fall back to periodic refresh while reconnecting.

The director can sign in, manage teams and players, schedule matches, start
innings, score deliveries and extras, undo the latest delivery, and complete
an innings early. The JWT remains in memory only, so a page reload requires
signing in again. The first director account must be provisioned separately;
the app does not expose an account-registration flow.
