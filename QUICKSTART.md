# Quick start

```powershell
cd agentos
npm run install:all
npm run dev
```

- http://localhost:5173/app/ai-worker  
- http://localhost:5173/app/jira-search  

Jira webhooks (second terminal):

```powershell
npm run tunnel
```

→ `https://<ngrok-host>/webhooks/jira`

Config: `server/.env` (Jira, DB, Redis). Optional `app/.env` for `VITE_API_URL` when testing against Render.
