# Jira intake (built into server)

AI Worker queue and board search run on the **server** (`server/`). The **app** (`app/`) calls them via `VITE_API_URL` in production or Vite proxy in dev.

| Page | App route | API |
|------|-----------|-----|
| AI Worker queue | `/app/ai-worker` | `GET /jira-intake/ai-worker/issues` |
| Board search | `/app/jira-search` | `GET /jira-intake/boards/search` |

## Local dev

```powershell
npm run dev
```

- App: http://localhost:5173/app/ai-worker  
- API: http://localhost:4000  

## Production

| Deploy | Root directory | Env |
|--------|----------------|-----|
| **Vercel** | `app` | `VITE_API_URL=https://<api-host>`, `VITE_API_MODE=rest` |
| **AWS App Runner** | `server` (Docker) | `CORS_ORIGIN` + `FRONTEND_URL` = `https://agentox.io`, `PUBLIC_API_URL` = API origin |

See [docs/AWS_MIGRATION.md](./docs/AWS_MIGRATION.md) to move off Render.

## Webhook URL

`https://<api-host>/webhooks/jira`

- `issue_created` → agent pipeline (needs worker + Redis)  
- other events (e.g. `issue_updated`) → AI Worker SQLite queue  
