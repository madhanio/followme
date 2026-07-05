# FollowMe

Automated GitHub repo discovery, NVIDIA NIM LLM grading, and auto follow/star tool

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-postgres-3ECF8E?logo=supabase&logoColor=white)
![NVIDIA NIM](https://img.shields.io/badge/NVIDIA-NIM-76B900?logo=nvidia&logoColor=white)
![Render](https://img.shields.io/badge/Worker-Render-46E3B7?logo=render&logoColor=white)
![Vercel](https://img.shields.io/badge/Dashboard-Vercel-black?logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

## How It Works

1. Scheduled job triggers the worker on Render to search for active repositories created in the last 30 days.
2. Extracts metadata and fetches the README file snippet for each discovered repository.
3. Sends extracted repository data to NVIDIA NIM (meta/llama-3.1-8b-instruct) for quality evaluation and grading (1-10).
4. Persists the repository information, grading score, reasoning, and system operation logs to Supabase.
5. Automatically stars the repository and follows its owner if the evaluation grade meets the set threshold.

## Architecture

- **Worker**: Node.js + node-cron on Render
- **Grading**: NVIDIA NIM (meta/llama-3.1-8b-instruct)
- **Storage**: Supabase Postgres
- **Dashboard**: Next.js 15 on Vercel

## Dashboard Screenshot

![Dashboard](assets/dashboard.png)

## Live Links

- Dashboard: https://followme-mauve.vercel.app
- Worker: https://followme-gg6q.onrender.com/health
