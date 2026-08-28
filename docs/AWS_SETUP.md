# IAM, budget, CLI, and first deploy

Do this as the account owner (`sudesha` / root). Region: **us-east-1**.

Expected AWS cost for this API (1 vCPU / 2 GB App Runner, always on): roughly **$8–20 / month**, plus whatever you spend on Bedrock. OpenAI stays billed at OpenAI, not AWS.

**Prefer the AWS website?** Use [Console-only deploy](#console-only-deploy) below. You stay logged in as `sudesha`, skip the `agentos-deploy` IAM user, skip Docker, and skip `deploy.ps1`. App Runner builds from GitHub.

The IAM user + CLI path is optional if you want laptop deploys later.

---

## Console-only deploy

Sign in at [https://console.aws.amazon.com](https://console.aws.amazon.com) as `sudesha` (or root). Switch the region (top right) to **us-east-1**.

### A. Budget (same as before)

[Billing → Budgets](https://console.aws.amazon.com/billing/home#/budgets) → **Create budget** → monthly **$50**, name `agentos-monthly`, email alerts at 50% / 80% / 100%. Enable IAM billing access under Account settings if that page is locked.

### B. Secret (the Render env vars)

1. [Secrets Manager → Store a new secret](https://console.aws.amazon.com/secretsmanager/home?region=us-east-1#/newsecret).
2. Secret type: **Other type of secret**.
3. **Plaintext** tab → paste the JSON from `server/infra/aws/secrets.example.json` filled with **real Render values**.
4. Secret name: `agentos/api`.
5. **Store**.

Keep `AUTH_JWT_SECRET` and `LOG_SOURCE_ENCRYPTION_KEY` identical to Render.

### C. Instance role (Bedrock + read the secret)

1. [IAM → Roles → Create role](https://console.aws.amazon.com/iam/home#/roles).
2. Trusted entity: **Custom trust policy**. Paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "tasks.apprunner.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

3. Skip permissions for a moment → name the role `agentos-apprunner-instance` → **Create role**.
4. Open the role → **Add permissions** → **Create inline policy** → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:596896523266:secret:agentos/api*"
    }
  ]
}
```

5. Name it `agentos-runtime` → **Create policy**.

### D. App Runner service

1. [App Runner → Create service](https://console.aws.amazon.com/apprunner/home?region=us-east-1#/create).
2. **Source:** Source code repository → **Add new** GitHub connection → authorize AWS → pick the `agentos` repo and branch `main`.
3. **Deployment:** Automatic (every push to `main` that App Runner sees).
4. **Configuration:** Dockerfile. **Source directory:** `server`. Port: `8080`.
5. Service name: `agentos-api`.
6. CPU: **1 vCPU**, Memory: **2 GB**.
7. **Auto scaling:** Custom configuration, min **1**, max **1** (do not leave the default max of 25).
8. **Security:** Instance role = `agentos-apprunner-instance`.
9. **Health check:** HTTP, path `/healthz`.
10. **Environment variables** (plain):

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `AWS_REGION` | `us-east-1` |
| `FRONTEND_URL` | `https://agentox.io` |
| `CORS_ORIGIN` | `https://agentox.io,https://www.agentox.io,https://agentos-blue.vercel.app` |
| `PUBLIC_API_URL` | `https://pending.invalid` (you will replace this in a minute) |
| `QA_OSS_ADAPTERS` | `0` |
| `CANARY_OSS_ADAPTERS` | `0` |
| `OSS_TOOLS_REQUIRED` | `0` |
| `ENGINEERING_SKIP_NPM_INSTALL` | `1` |
| `PIPELINE_MAX_CONCURRENT_ORGS` | `1` |
| `CODEBASE_GITNEXUS_GRAPH` | `0` |

11. **Secrets:** add `APP_SECRETS` → Secrets Manager → `agentos/api` (the whole secret, not a JSON key).
12. **Create & deploy**. First build takes several minutes.

When status is **Running**, copy the default URL (`https://xxxx.us-east-1.awsapprunner.com`). Edit the service → change `PUBLIC_API_URL` to that URL → **Deploy**.

Open:

- `https://xxxx.us-east-1.awsapprunner.com/healthz`
- `https://xxxx.us-east-1.awsapprunner.com/readyz` → should include `"postgres":"ok"`

Then do the [cut over from Render](#8-cut-over-from-render) (OAuth callbacks, Vercel `VITE_API_URL`, reconnect Jira).

You do **not** need Docker Desktop or `aws configure` for this path.

---


## 1. Turn on billing alerts (once per account)

1. Sign in at [https://console.aws.amazon.com](https://console.aws.amazon.com).
2. Click the account name (top right) → **Account**.
3. Under **IAM User and Role Access to Billing Information**, click **Edit**, enable **Activate IAM Access**, **Update**.
4. Open [Billing → Billing preferences](https://console.aws.amazon.com/billing/home#/preferences).
5. Enable **Receive PDF Invoice By Email** if you want invoices.
6. Open [Billing → Billing alarms](https://console.aws.amazon.com/billing/home#/alarms) is optional; the budget in step 3 is enough.

Confirm a verified email: [Billing → Billing preferences → Billing alerts] or SES/account email. Budgets will email that address.

---

## 2. Create the IAM user

1. Open [IAM → Users](https://console.aws.amazon.com/iam/home#/users) → **Create user**.
2. User name: `agentos-deploy`.
3. Check **Provide user access to the AWS Management Console** only if you want this user to click around in the console. For deploy-from-laptop, leave it **unchecked**.
4. **Next**.
5. **Attach policies directly** → **Create policy**.
6. JSON tab → paste the contents of [`server/infra/aws/iam-deploy-policy.json`](../server/infra/aws/iam-deploy-policy.json).
7. Name the policy `agentos-deploy` → **Create policy**.
8. Back on the user wizard, refresh, attach `agentos-deploy` → **Next** → **Create user**.

### Access keys

1. Open the user `agentos-deploy` → **Security credentials**.
2. **Create access key** → **Command Line Interface (CLI)** → confirm → **Create**.
3. Download the `.csv` or copy:
   - Access key ID
   - Secret access key  
   You will not see the secret again.

Do **not** use the `sudesha` keys for deploy.

---

## 3. Create a monthly budget

1. Open [Billing → Budgets](https://console.aws.amazon.com/billing/home#/budgets) → **Create budget**.
2. **Use a template** → **Monthly cost budget** (or **Customize**).
3. Set:
   - Budget name: `agentos-monthly`
   - Period: Monthly
   - Budget amount: **$50** (or $25 if you want a tighter cap)
   - Scope: **All AWS services** (this account)
4. Alerts (email = an address you check):
   - 50% actual (`$25`)
   - 80% actual (`$40`)
   - 100% actual (`$50`)
   - Optional: 100% **forecasted**
5. **Create budget**.

This does not stop spend by itself. It emails you. App Runner with max instances = 1 cannot scale out; Bedrock is the main variable cost.

---

## 4. Configure the AWS CLI on this machine

In PowerShell:

```powershell
aws configure --profile agentos
```

Enter:

| Prompt | Value |
|--------|--------|
| AWS Access Key ID | from `agentos-deploy` |
| AWS Secret Access Key | from `agentos-deploy` |
| Default region name | `us-east-1` |
| Default output format | `json` |

Use that profile for everything:

```powershell
$env:AWS_PROFILE = "agentos"
aws sts get-caller-identity
```

You should see `"Arn": "...:user/agentos-deploy"`, **not** `sudesha`.

To keep the profile in new terminals:

```powershell
[System.Environment]::SetEnvironmentVariable("AWS_PROFILE", "agentos", "User")
```

---

## 5. Start Docker Desktop

Wait until the whale icon is idle / “Docker Desktop is running”. Then:

```powershell
docker version
```

`Server` must show an Engine version. If you see `dockerDesktopLinuxEngine` pipe errors, Docker is not up yet.

---

## 6. Fill production secrets

```powershell
cd C:\Users\sudes\agentos\server
Copy-Item infra\aws\secrets.example.json infra\aws\secrets.json
notepad infra\aws\secrets.json
```

Copy values from the Render **agentos-api → Environment** tab.

Keep these **identical** to Render:

- `AUTH_JWT_SECRET`
- `LOG_SOURCE_ENCRYPTION_KEY`
- `DATABASE_URL` / `DIRECT_DATABASE_URL`
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`

Do not commit `secrets.json`.

---

## 7. Deploy

```powershell
cd C:\Users\sudes\agentos\server
$env:AWS_PROFILE = "agentos"
.\infra\aws\deploy.ps1 -Region us-east-1
```

First run takes several minutes (image build + App Runner). When it prints a `Service URL`, wait until status is `RUNNING`:

```powershell
aws apprunner list-services --region us-east-1
```

Then:

```powershell
curl https://<id>.us-east-1.awsapprunner.com/healthz
curl https://<id>.us-east-1.awsapprunner.com/readyz
```

`/readyz` must include `"postgres":"ok"`. Save that origin as `API`.

---

## 8. Cut over from Render

Replace `https://agentos-sc05.onrender.com` with `API`:

| Where | Value |
|-------|--------|
| Google Cloud OAuth | `API/api/auth/google/callback` |
| Atlassian | `API/api/jira/oauth/callback` |
| GitHub App | callback + webhook `API/webhooks/github` |
| Bitbucket OAuth | `API/api/git-integration/oauth/bitbucket/callback` |
| Vercel `VITE_API_URL` | `API` (no trailing slash), then redeploy |
| Product → Jira | Disconnect + reconnect so webhooks re-register |

Smoke-test sign-in, the work board, and one AI Worker ticket. Then **suspend** Render (do not delete for a few days).

---

## If something fails

| Symptom | Fix |
|---------|-----|
| `sts get-caller-identity` is still `sudesha` | `$env:AWS_PROFILE = "agentos"` |
| AccessDenied on CloudFormation / IAM | Policy `agentos-deploy` not attached, or you used the wrong keys |
| Docker pipe / engine error | Start Docker Desktop and retry |
| Missing `secrets.json` | Step 6 |
| `/readyz` postgres error | `DATABASE_URL` in `secrets.json` is wrong |
| App Runner stuck creating | `aws apprunner list-operations --service-arn <arn> --region us-east-1` |

Update secrets later without rebuilding the image:

```powershell
.\infra\aws\deploy.ps1 -SecretsOnly
aws apprunner start-deployment --service-arn <arn> --region us-east-1
```
