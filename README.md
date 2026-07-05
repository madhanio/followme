# FollowMe 🚀 — GitHub AI Repository Auto-Evaluator & Automation Tool

FollowMe is a self-hosted, fully automated full-stack tool that discovers, evaluates (via NVIDIA NIM LLM API), and follows/stars GitHub repositories based on your specific quality criteria and technical interests.

## Features
- **Auto-Discovery**: Daily/scheduled queries to the GitHub Search API for trending or recently updated repositories in selected topics (e.g., `ai`, `machine-learning`, `llm`, `flutter`, `nodejs`, `python`).
- **AI-Powered Repository Grading**: Evaluates repository READMEs, descriptions, stars, and topics using NVIDIA NIM (`meta/llama-3.1-8b-instruct`) on a scale of 1 to 10.
- **Automated Interaction**: Automatically stars the repository and follows its owner if the score meets your configuration threshold.
- **Beautiful Dashboard**: A modern, interactive Next.js dashboard featuring metrics, filters, modal README snippet view, historical log inspections, and manual triggers.

---

## Architecture Diagram

```mermaid
graph TD
    subgraph "Local or Cloud Worker (Render / Docker)"
        W[Node.js Scheduled Job]
        C[Express Trigger API]
    end

    subgraph "Third-Party Services"
        G[GitHub API]
        N[NVIDIA NIM AI API]
    end

    subgraph "Database & Storage"
        S[(Supabase Postgres)]
    end

    subgraph "Frontend Dashboard (Vercel / Next.js)"
        D[Next.js App]
    end

    W -->|1. Search Repos| G
    W -->|2. Send Repo Metadata| N
    N -->|3. Return Grade & Reason| W
    W -->|4. Save Repo & Logs| S
    W -->|5. Star & Follow (if Grade >= Threshold)| G
    
    C -->|Trigger Immediate Job| W
    D -->|Query Database| S
    D -->|POST /run with Secret| C
```

---

## Supabase Database Setup

Run the following SQL in your Supabase SQL Editor to create the necessary tables and indexes:

```sql
-- Create repos table
CREATE TABLE IF NOT EXISTS repos (
    id BIGINT PRIMARY KEY, -- GitHub Repo ID to avoid duplicates
    github_url TEXT NOT NULL,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    stars INTEGER NOT NULL DEFAULT 0,
    language TEXT,
    topics TEXT[] DEFAULT '{}',
    readme_snippet TEXT,
    grade INTEGER,
    graded_at TIMESTAMPTZ,
    followed BOOLEAN DEFAULT FALSE,
    starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create logs table for tracking actions
CREATE TABLE IF NOT EXISTS logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action TEXT NOT NULL, -- e.g., 'DISCOVER', 'GRADE', 'STAR', 'FOLLOW', 'SYSTEM'
    repo_id BIGINT REFERENCES repos(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED'
    message TEXT
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_repos_grade ON repos(grade);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repos(language);
CREATE INDEX IF NOT EXISTS idx_repos_followed ON repos(followed);
CREATE INDEX IF NOT EXISTS idx_repos_starred ON repos(starred);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
```

---

## Environment Variables

### 1. Worker backend (`worker/`)
Create a `.env` file under `worker/` directory:
```bash
PORT=8000
WORKER_SECRET=your-shared-secret-key-here
GRADE_THRESHOLD=7
CRON_SCHEDULE=0 */12 * * *

GITHUB_TOKEN=your_github_personal_access_token
GITHUB_USERNAME=your_github_username
NVIDIA_API_KEY=nvapi-your-nvidia-key
SUPABASE_URL=https://your-supabase-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Dashboard frontend (`dashboard/`)
Create a `.env.local` file under `dashboard/` directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_WORKER_URL=https://your-worker-app.onrender.com
WORKER_SECRET=your-shared-secret-key-here
```

---

## Local Development

### 1. Running the Worker
```bash
cd worker
npm install
npm run dev
```

### 2. Running the Dashboard
```bash
cd dashboard
npm install
npm run dev
```

---

## LLM-Based Grading Prompt details
Grading uses the high-performance `meta/llama-3.1-8b-instruct` model hosted on NVIDIA NIM. It evaluates the repository based on three pillars:
- **Quality**: Structuring, code patterns, and documentations.
- **Originality**: Novel solutions vs forks or boilerplate templates.
- **Usefulness**: Practical value to the open-source community.
The model returns a JSON payload containing the `grade` integer and a concise `reason` justifying the grade.
