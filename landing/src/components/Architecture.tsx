'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Copy, Terminal, Check } from 'lucide-react';

const ARCHITECTURE_FLOW = `┌────────────────────────────────────────────────────────┐
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
└──────────────────┘ └─────────────────┘ └──────────────────┘`;

export function Architecture() {
  const [copied, setCopied] = React.useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('git clone https://github.com/madhanio/followme.git\ncd followme\ncp .env.example .env\ndocker compose up -d --build');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="architecture" className="w-full bg-frame border-t border-b border-foreground/10 px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            Self-Hosted Infrastructure
          </span>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mt-2">
            Clean, decoupled architecture.
          </h2>
          <p className="text-muted-foreground text-base mt-3">
            Deploy worker and database components independently on Docker, Render, or Railway with complete data ownership.
          </p>
        </div>

        {/* ASCII Architecture Box */}
        <div className="relative rounded-2xl bg-background border border-foreground/15 p-6 md:p-8 font-mono text-xs md:text-sm overflow-x-auto shadow-xl">
          <pre className="text-foreground/90 whitespace-pre leading-relaxed">{ARCHITECTURE_FLOW}</pre>
        </div>

        {/* Quickstart Terminal Card */}
        <div className="mt-8 rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-accent" />
              <span className="text-xs font-mono text-neutral-400">Quick Start via Docker Compose</span>
            </div>
            <button
              onClick={copyCommand}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy commands'}
            </button>
          </div>
          <pre className="pt-4 font-mono text-xs sm:text-sm text-neutral-300 overflow-x-auto space-y-1">
            <code>
              <span className="text-neutral-500"># 1. Clone repository</span>
              {'\n'}git clone https://github.com/madhanio/followme.git
              {'\n'}cd followme
              {'\n\n'}
              <span className="text-neutral-500"># 2. Configure credentials (.env)</span>
              {'\n'}cp .env.example .env
              {'\n\n'}
              <span className="text-neutral-500"># 3. Launch stack (Worker + Console)</span>
              {'\n'}docker compose up -d --build
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
