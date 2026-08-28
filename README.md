# FollowMe

Automated GitHub repository discovery, NVIDIA NIM LLM evaluation, and intelligent developer community networking tool.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-postgres-3ECF8E?logo=supabase&logoColor=white)
![NVIDIA NIM](https://img.shields.io/badge/NVIDIA-NIM-76B900?logo=nvidia&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![Render](https://img.shields.io/badge/Worker-Render-46E3B7?logo=render&logoColor=white)
![Vercel](https://img.shields.io/badge/Dashboard-Vercel-black?logo=vercel&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Scheduler-2088FF?logo=github-actions&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Overview & Dashboard

FollowMe continuously searches for recently created repositories across your tech stack, analyzes code snippets and READMEs with LLMs (NVIDIA NIM), filters for active peer builders (students, hobbyists, independent developers), automatically stars quality projects, and manages mutual connections with customizable grace periods.

![FollowMe Dashboard](assets/dashboard.png)

---

## Key Features

- **AI Code & README Evaluation:** Grades repositories on a scale of 1–10 using NVIDIA NIM (`meta/llama-3.1-8b-instruct`), identifying genuine builders and original projects while penalizing unchanged copies.
- **Smart Peer Targeting:** Filters accounts based on follower ranges, account maturity, and organic follow ratios (stars high-profile developers instead of following).
- **Persistent Evaluation Cache:** Stores low-score and skipped repositories in Supabase with `follow_skipped` flags to prevent repeated re-evaluation and conserve LLM API credits.
- **Live GitHub Rate Limit Monitor:** Real-time Core API and Search API quota tracking with dynamic progress bars and $<20\%$ remaining alert thresholds.
- **Automated Grace Period & Cleanup:** Configurable non-followback grace period (default 7 days) and mutual sync engine.
- **Dedicated Console Views:** Dedicated pages for `/profiles`, `/repositories`, `/logs`, and `/?tab=stats` with search, filters, and paginated tables.
- **Dual Authentication:** Secure master password login and one-click GitHub OAuth authentication.
- **Loud Quota Alerts:** Immediate fatal alerting to database logs on AI API key exhaustion or rate limit walls.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                   GitHub Ecosystem                     │
│  (Repo Search, User Profiles, Follow/Star API, OAuth)  │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     Background Worker     │   │      Next.js Console      │
│  (Node.js / Express API)  │   │  (Dashboard UI & Actions) │
└─────────────┬─────────────┘   └─────────────┬─────────────┘
              │                               │
              ├───────────────┬───────────────┤
              ▼               ▼               ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│    NVIDIA NIM    │ │ Supabase DB     │ │  GitHub Actions  │
│  (LLM Evaluator) │ │ (PostgreSQL)    │ │   (Scheduler)    │
└──────────────────┘ └─────────────────┘ └──────────────────┘
```

---

## Before You Begin

> [!NOTE]
> The `/demo` folder in this repository contains seed/mock data used for the reference demo deployment. It is not required for your own self-hosted instance and can safely be removed or ignored.

---

## Quick Start (Docker Compose)

The easiest way to run the complete FollowMe stack (Worker + Dashboard) locally or on a VPS is with Docker Compose:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/madhanio/followme.git
   cd followme
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Fill in your credentials in `.env` (Supabase, GitHub PAT, NVIDIA NIM key, master password).

3. **Start services:**
   ```bash
   docker compose up -d --build
   ```

4. **Access Dashboard:** Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Cloud Self-Hosting Guide

### 1. Prerequisites & API Keys

Gather the following credentials before deployment:

* **GitHub Personal Access Token (PAT):** Create a token under **GitHub Settings → Developer Settings → Personal Access Tokens**. Required scopes: `user:follow`, `public_repo`, `read:user`.
* **NVIDIA NIM API Key:** Obtain a key at [build.nvidia.com](https://build.nvidia.com/).
* **Supabase Project:** Create a project at [supabase.com](https://supabase.com). Copy the **Project URL**, `anon` key, and `service_role` key from **Project Settings → API**.

> [!WARNING]
> Keep your secret keys secure and never commit `.env` files with real credentials to your git repository.

---

### 2. Database Setup (Supabase)

1. Open your Supabase project dashboard and navigate to **SQL Editor**.
2. Click **New Query**.
3. Copy the contents of [`schema.sql`](./schema.sql) and click **Run**.

---

### 3. Deploy Background Worker (Render)

1. Create a new **Web Service** on [Render](https://render.com) and link your repository.
2. Set **Root Directory** to `worker`.
3. Configure the environment variables (see [`worker/.env.example`](./worker/.env.example)):

```env
PORT=8000
WORKER_SECRET=your_worker_secret_here
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_USERNAME=your_github_username_here
NVIDIA_API_KEY=your_nvidia_api_key_here
SUPABASE_URL=https://your_supabase_url_here.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

4. Deploy the service and note your service URL (e.g. `https://your-worker.onrender.com`).

---

### 4. Deploy Dashboard Console (Vercel)

1. Import your repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `dashboard`.
3. Configure the environment variables (see [`dashboard/.env.example`](./dashboard/.env.example)):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your_supabase_url_here.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
NEXT_PUBLIC_WORKER_URL=https://your-worker.onrender.com
WORKER_URL=https://your-worker.onrender.com
WORKER_SECRET=your_worker_secret_here
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_USERNAME=your_github_username_here
DASHBOARD_PASSWORD=your_dashboard_password_here
NEXT_PUBLIC_APP_URL=https://your-dashboard.vercel.app
```

4. Click **Deploy**.

---

### 5. GitHub OAuth Setup (Optional)

To enable the "Continue with GitHub" login button on your dashboard:

1. In GitHub, go to **Settings → Developer Settings → OAuth Apps → New OAuth App**.
2. Set **Application Name** to `FollowMe Dashboard`.
3. Set **Homepage URL** to your dashboard URL (e.g., `https://your-dashboard.vercel.app` or `http://localhost:3000`).
4. Set **Authorization callback URL** to:
   `https://your-dashboard.vercel.app/api/auth/callback/github` (or `http://localhost:3000/api/auth/callback/github`).
5. Copy the **Client ID** and generate a **Client Secret**.
6. Add these to your dashboard environment variables:
   ```env
   GITHUB_CLIENT_ID=your_github_oauth_client_id_here
   GITHUB_CLIENT_SECRET=your_github_oauth_client_secret_here
   ```

---

### 6. Automated CRON Execution (GitHub Actions)

1. In your GitHub repository, navigate to **Settings → Secrets and variables → Actions**.
2. Add the following repository secrets:
   - `WORKER_URL`: `https://your-worker.onrender.com/run`
   - `WORKER_SECRET`: The shared worker secret string.
3. Enable workflows under the **Actions** tab. The discovery job runs every 6 hours automatically.

---

## Environment Variables Reference

| Variable | Required By | Description |
|---|---|---|
| `GITHUB_TOKEN` | Worker & Dashboard | GitHub Personal Access Token (`read:user`, `user:follow`, `public_repo`) |
| `GITHUB_USERNAME` | Worker & Dashboard | Your GitHub username for account locking and mutual sync |
| `NVIDIA_API_KEY` | Worker | API Key from build.nvidia.com for LLM grading |
| `SUPABASE_URL` | Worker & Dashboard | Supabase PostgreSQL project URL |
| `SUPABASE_ANON_KEY` | Worker & Dashboard | Supabase public anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard | Supabase service role key for settings and logs management |
| `WORKER_SECRET` | Worker & Dashboard | Shared secret header (`x-worker-secret`) to protect API endpoints |
| `DASHBOARD_PASSWORD` | Dashboard | Master password for dashboard web console |
| `GITHUB_CLIENT_ID` | Dashboard | Optional GitHub OAuth Application Client ID |
| `GITHUB_CLIENT_SECRET` | Dashboard | Optional GitHub OAuth Application Client Secret |
| `NEXT_PUBLIC_APP_URL` | Dashboard | Production dashboard URL for OAuth redirects |

---

## License

Distributed under the [MIT License](LICENSE).
