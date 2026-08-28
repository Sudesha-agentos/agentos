# Migrate AgentOS API from Render to AWS

The API is a long-running Node 22 process (in-process pipelines + Jira sync). It is **not** a Lambda app. The closest Render equivalent is **AWS App Runner** with **max instances = 1**.

Postgres stays on **Supabase** (already hosted on AWS). Do not dump/restore the database unless you are also moving off Supabase.

## What you need

- AWS account + IAM user/role that can manage App Runner, ECR, IAM, and Secrets Manager
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured (`aws sts get-caller-identity`)
- Docker Desktop (builds `linux/amd64`)
- Values copied from the Render `agentos-api` environment tab

Recommended region: `us-east-1` (Bedrock + App Runner).

**First time:** follow **[docs/AWS_SETUP.md](./AWS_SETUP.md)** (IAM user, monthly budget, AWS CLI profile, then deploy).

## 1. Copy secrets from Render

```powershell
cd server
Copy-Item infra/aws/secrets.example.json infra/aws/secrets.json
```

Fill `infra/aws/secrets.json` from Render. Required for a working cutover:

| Key | Notes |
|-----|--------|
| `AUTH_JWT_SECRET` | **Must match Render** or every logged-in session is invalidated |
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | Same Supabase URLs as Render |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | RAG + embeddings |
| `OPENAI_API_KEY` | Agents |
| `GOOGLE_*` / `ATLASSIAN_*` / `GITHUB_APP_*` | OAuth + GitHub App |
| `LOG_SOURCE_ENCRYPTION_KEY` | Must match Render or log-source configs cannot decrypt |

Do not commit `secrets.json`.

## 2. Deploy

```powershell
cd server
.\infra\aws\deploy.ps1 -Region us-east-1
```

The script:

1. Creates ECR `agentos-api`, IAM roles, and a Secrets Manager secret
2. Uploads `secrets.json`
3. Builds and pushes the Docker image
4. Creates App Runner `agentos-api` (1 vCPU / 2 GB, **one instance**)
5. Sets `PUBLIC_API_URL` to the App Runner URL

Wait until the service is `RUNNING`:

```powershell
aws apprunner list-services --region us-east-1
curl https://<service-id>.us-east-1.awsapprunner.com/healthz
curl https://<service-id>.us-east-1.awsapprunner.com/readyz
```

`/readyz` should show `"postgres":"ok"`.

Update secrets later without rebuilding:

```powershell
.\infra\aws\deploy.ps1 -SecretsOnly
aws apprunner start-deployment --service-arn <arn>
```

## 3. Point OAuth and the frontend at the new URL

Replace `https://agentos-sc05.onrender.com` with the App Runner URL (or `https://api.agentox.io` if you attach a custom domain).

| Place | What to change |
|-------|----------------|
| Google Cloud OAuth | Authorized redirect `…/api/auth/google/callback` |
| Atlassian developer console | `…/api/jira/oauth/callback` |
| GitHub App | Callback + webhook URL |
| Bitbucket OAuth consumer | `…/api/git-integration/oauth/bitbucket/callback` |
| Vercel `VITE_API_URL` | New API origin, then redeploy the app |
| Jira | Disconnect + reconnect so webhooks re-register |

Optional custom domain on App Runner: `api.agentox.io`, then rerun deploy with `-PublicApiUrl https://api.agentox.io`.

## 4. Smoke test, then suspend Render

1. Sign in at https://agentox.io
2. Open a workspace board — Jira tickets still load (same Supabase DB)
3. Move a test ticket to AI Worker — pipeline enqueues
4. Confirm Google / Jira / GitHub connect still round-trips

When that works, **suspend** (do not delete yet) the Render `agentos-api` service. Keep it for a few days in case you need to roll back: restore `VITE_API_URL` and OAuth callbacks to the Render host.

## GitHub Actions

After the first manual deploy, add repo secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (`us-east-1`)

Pushes to `main` that touch `server/**` build and push `agentos-api:latest`. App Runner auto-deploys from ECR.

## Why not ECS / RDS / Lambda

| Option | Why not for this cutover |
|--------|---------------------------|
| Lambda | Pipelines and Jira sync run in-process for minutes |
| Multiple App Runner instances | Would duplicate the 15-minute Jira sync and intake pollers |
| RDS | Supabase already holds prod data + pgvector; moving it is a separate project |
| ECS Fargate + EFS | Use later if you need a persistent disk for SQLite / git workspaces |

SQLite under `/app/data` is ephemeral on App Runner (same as Render without a disk). Queue and git credentials already rehydrate from Postgres on boot.
