# Kharcha Journal — Backend

Cloudflare Workers API with Hono + D1 only.

## Stack

- **Worker** — API server (Hono)
- **D1** — SQLite database for all data

No KV or R2 required.

## Local development

`wrangler dev` uses your **cloud D1** database (same as the Cloudflare dashboard and production).

```bash
cd backend
pnpm install
wrangler d1 migrations apply DB --remote   # first time / after schema changes
wrangler dev                                 # http://localhost:8787
```

Requires `wrangler login` and an internet connection.

## Deploy

```bash
cd backend
wrangler d1 migrations apply DB --remote   # after schema changes
wrangler secret put JWT_SECRET
wrangler secret put JWT_REFRESH_SECRET
wrangler deploy
```

## Helper commands

| Command | Description |
|---------|-------------|
| `wrangler dev` | Local API using cloud D1 |
| `wrangler deploy` | Deploy worker |
| `pnpm db:migrate` | Run migrations on D1 |
| `pnpm db:users` | List users in D1 |
| `pnpm db:clear-users` | Delete all users in D1 |

## Environment (`backend/.dev.vars`)

```
JWT_SECRET=your-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
```
