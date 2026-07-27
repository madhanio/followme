# FollowMe

Automated GitHub repo discovery, NVIDIA NIM LLM grading, and auto follow/star tool

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-postgres-3ECF8E?logo=supabase&logoColor=white)
![NVIDIA NIM](https://img.shields.io/badge/NVIDIA-NIM-76B900?logo=nvidia&logoColor=white)
![Render](https://img.shields.io/badge/Worker-Render-46E3B7?logo=render&logoColor=white)
![Vercel](https://img.shields.io/badge/Dashboard-Vercel-black?logo=vercel&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Scheduler-2088FF?logo=github-actions&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

## Dashboard

![FollowMe Dashboard](assets/dashboard.png)

## How It Works

1. **Discovery**: Scheduled GitHub Actions workflow searches GitHub for active repositories created in the last 7 days matching targeted topic tags.
2. **AI Evaluation**: Fetches the README snippet and submits it to **NVIDIA NIM** (`meta/llama-3.1-8b-instruct`), grading the repository from 1 to 10 with a focus on student learning effort, original prototypes, and community builders.
3. **Smart Follow Filter**: Filters out "ego" developer accounts. Follows are executed only if the target user has a peer-profile signature (20-500 followers, following > 20, ratio 0.5-2.0, account age > 6 months). High-profile accounts are starred but skipped for follows.
4. **Data Sync**: Stores evaluation history, grades, actions, skip logs, and follow statuses in Supabase.
5. **Periodic Cleanup**: A GitHub Actions workflow triggers every 6 hours, checking all auto-followed accounts. If they fail to follow back within 3 days, it automatically unfollows them to maintain healthy account statistics.

## Architecture

- **Worker:** Node.js + Express on Render, triggered on-demand via its /run endpoint
- **Scheduler:** GitHub Actions workflows (discovery + cleanup, every 6 hours)
Grading Engine: NVIDIA NIM LLM Integration
- **Storage Layer:** Supabase PostgreSQL database
- **Web Console:** Next.js 15 UI with monochrome design dashboard on Vercel

## Self-Hosting & Deployment Guide

Follow this guide to spin up your own instance of **FollowMe**.

### 1. Prerequisites & API Keys

Before starting, gather the following credentials:

> [!NOTE]
> Make sure your GitHub Personal Access Token has `user:follow`, `public_repo`, and `read:user` permissions.

> [!WARNING]
> Keep your `WORKER_SECRET_KEY` and `GITHUB_TOKEN` secure and never commit them directly to the repository.
* **NVIDIA NIM API Key:** Get a free key at [build.nvidia.com](https://build.nvidia.com/).
* **Supabase Project:** Create a free project at [supabase.com](https://supabase.com/).

---

### 2. Database Setup (Supabase)

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Paste the contents of [`schema.sql`](./schema.sql) and run the script to initialize tables for evaluation history, follow tracking, and queue state.

---

### 3. Deploy the Background Worker (Render)

1. Fork or clone this repository.
2. Create a new **Web Service** on [Render](https://render.com/) pointing to your repository.
3. Set the **Root Directory** to `worker` (or build from the root if deploying as a monorepo).
4. Configure the following **Environment Variables**:

```env
PORT=3000
GITHUB_TOKEN=your_github_personal_access_token
NVIDIA_NIM_API_KEY=your_nvidia_nim_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Deploy the service and save your public service URL (e.g., https://your-worker.onrender.com).

---

### 4. Deploy the Web Dashboard (Vercel)
1. Import your repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `dashboard`.
3. Add the required **Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
WORKER_ENDPOINT=https://your-worker.onrender.com
```

4. Click Deploy.

---

### 5. Automate with GitHub Actions
To enable automated background execution:

1. Go to **Settings** -> **Secrets and variables** -> **Actions**.
2. Add the following **Repository Secrets**:
   * `WORKER_URL`: Your deployed worker endpoint (e.g., `https://your-worker.onrender.com/run`)
   * `WORKER_SECRET_KEY`: (Optional) Secret key if you secured your `/run` route.
3. Enable the workflows under the **Actions** tab.

## Live Links
* **Dashboard Demo**: https://followme-mads.vercel.app

* **Worker Health Check**: https://your-worker.onrender.com/health

## License
Distributed under the [MIT License](LICENSE)
