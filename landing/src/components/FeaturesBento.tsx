'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Activity,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Flame,
} from 'lucide-react';

const easeBezier = [0.23, 1, 0.32, 1] as const;

export function FeaturesBento() {
  const cardVariant = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.8, ease: easeBezier },
  };

  return (
    <section id="features" className="w-full px-6 mb-32 bg-background scroll-mt-28">
      <div className="max-w-5xl mx-auto">
        {/* Section Heading - Clean subtle eyebrow matching The FollowMe Philosophy */}
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            Core Platform Capabilities
          </span>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">
          {/* Card 1: Main Highlight - AI Evaluation Engine with Device Phone Frame */}
          <motion.div
            {...cardVariant}
            className="group bg-card-primary rounded-4xl p-8 pb-0 overflow-hidden min-h-140 md:row-span-2 flex flex-col justify-between"
          >
            <div className="relative z-10 text-center mb-6 transition-transform duration-500 ease-out group-hover:scale-105">
              <h3 className="text-2xl md:text-4xl font-medium text-neutral-900 leading-tight mb-3">
                Intelligent Profile Evaluation
              </h3>
              <p className="text-neutral-800 text-sm font-medium">
                AI grades code substance and architecture on a 1–100 scale
              </p>
            </div>

            {/* Realistic Device Phone Mockup with Notch and Live Score Card (Crisp White Screen, Black Border) */}
            <div className="flex-1 flex justify-center items-end transition-transform duration-500 ease-out group-hover:scale-[1.02]">
              <div className="relative bg-white shadow-2xl border-black overflow-hidden z-10 w-60 md:w-68 h-96 md:h-112 rounded-t-4xl border-6 border-b-0">
                {/* Dynamic Island Notch */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full z-10 top-2 w-20 h-5"
                  aria-hidden="true"
                />

                <div className="absolute inset-0 bg-white pt-12 px-5 text-neutral-900">
                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                    <span className="font-medium">Scanned Profile</span>
                    <span className="font-mono text-[10px] bg-accent/40 text-black px-1.5 py-0.5 rounded font-semibold">
                      eval_id: #8921
                    </span>
                  </div>

                  <h4 className="text-2xl font-bold text-neutral-900 leading-tight tracking-tight">
                    rust-hyper-db
                  </h4>
                  <p className="text-xs text-neutral-600 mb-4 font-normal">
                    High throughput in-memory key-value engine
                  </p>

                  {/* Gradient Card with Live Score on 1-100 scale */}
                  <div className="relative bg-gradient-to-br from-accent via-accent/90 to-accent/60 rounded-2xl p-4 h-50 shadow-lg overflow-hidden text-neutral-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-75">
                          AI Assessment
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-4xl font-black">94</span>
                          <span className="text-xs font-bold opacity-75">/ 100</span>
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-black/10">
                        <CheckCircle2 className="w-5 h-5 text-black" />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs font-medium">
                      <div className="flex items-center justify-between bg-black/10 px-2.5 py-1 rounded-lg">
                        <span>Novelty & Logic</span>
                        <span className="font-bold">Exceptional</span>
                      </div>
                      <div className="flex items-center justify-between bg-black/10 px-2.5 py-1 rounded-lg">
                        <span>Action Taken</span>
                        <span className="font-bold text-black">Starred + Followed</span>
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-neutral-900 opacity-80">
                      <span>NVIDIA NIM</span>
                      <span>•</span>
                      <span>llama-3.3-70b</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 2: GitHub Rate-Limit Radar Monitor */}
          <motion.div
            {...cardVariant}
            className="group bg-card-secondary rounded-4xl p-8 overflow-hidden min-h-80 relative flex flex-col md:block"
          >
            <div className="relative z-10 max-w-48 transition-transform duration-500 ease-out group-hover:scale-105">
              <h3 className="text-xl md:text-2xl whitespace-nowrap font-medium text-card-foreground leading-tight mb-3">
                Rate-Limit Protection
              </h3>
              <p className="text-card-foreground-muted text-sm">
                Monitors GitHub Core and Search quotas in real time
              </p>
            </div>

            {/* Radar Pulse Concentric Circles */}
            <div className="relative md:absolute mt-8 md:mt-0 md:right-12 md:top-1/2 md:-translate-y-1/2 flex items-center justify-center transition-transform duration-500 ease-out group-hover:scale-105 self-center md:self-auto">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                <div className="absolute size-56 border border-accent/80 rounded-full" />
                <div className="absolute size-72 border border-accent/60 rounded-full" />
                <div className="absolute size-88 border border-accent/40 rounded-full" />
              </div>

              {/* Status Phone Mockup (White Screen, Black Border) */}
              <div className="relative bg-white shadow-2xl border-black overflow-hidden z-10 w-44 md:w-48 h-64 md:h-72 rounded-3xl border-4 text-neutral-900">
                <div className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full z-10 top-2 w-16 h-4" aria-hidden="true" />
                <div className="absolute inset-0 bg-white pt-9 px-3">
                  <div className="bg-neutral-100 rounded-full px-2 py-1.5 mb-3 flex items-center gap-1.5 border border-neutral-200">
                    <span className="text-neutral-500 text-xs font-mono">Search API Quota...</span>
                  </div>
                  <p className="text-xs text-neutral-500 mb-0.5 font-medium">Core API Remaining</p>
                  <p className="text-xl font-bold text-neutral-900 mb-3 tracking-tight">4,920 req/hr</p>
                  <div className="flex gap-1.5 mb-4">
                    <span className="bg-accent text-black text-xs px-2.5 py-1 rounded-full font-semibold">Safe</span>
                    <span className="text-neutral-500 text-xs px-2 py-1 font-medium">2h cycle</span>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-neutral-900 rounded-2xl px-5 py-3 shadow-xl z-20 whitespace-nowrap">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-neutral-400 text-xs">Worker Status</span>
                  <span className="text-neutral-500 text-xs">ⓘ</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium text-white">Running</span>
                  <span className="text-xs font-medium text-accent bg-accent/20 px-2 py-0.5 rounded">✓ 100% OK</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sub Grid 2 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 3: Evaluated Over 12k+ Profiles */}
            <motion.div
              {...cardVariant}
              className="group bg-card-secondary rounded-4xl p-6 md:p-8 flex flex-col justify-between min-h-64"
            >
              <div className="transition-transform duration-500 ease-out group-hover:scale-105">
                <h3 className="text-xl md:text-2xl font-medium text-card-foreground leading-tight mb-1">
                  Evaluated Over
                </h3>
                <h3 className="text-xl md:text-2xl font-medium text-card-foreground leading-tight mb-3">
                  12k+ Profiles
                </h3>
              </div>
              <div className="my-auto transition-transform duration-500 ease-out group-hover:scale-105">
                <div className="flex items-center">
                  <div className="size-11 rounded-full border-2 border-white/25 overflow-hidden -ml-3.5 first:ml-0 bg-neutral-800 flex items-center justify-center text-xs font-bold text-white">TS</div>
                  <div className="size-11 rounded-full border-2 border-white/25 overflow-hidden -ml-3.5 bg-neutral-700 flex items-center justify-center text-xs font-bold text-white">PY</div>
                  <div className="size-11 rounded-full border-2 border-white/25 overflow-hidden -ml-3.5 bg-neutral-600 flex items-center justify-center text-xs font-bold text-white">RS</div>
                  <div className="size-11 rounded-full border-2 border-white/25 overflow-hidden -ml-3.5 bg-neutral-500 flex items-center justify-center text-xs font-bold text-white">GO</div>
                  <div className="size-11 rounded-full border-2 border-white/25 bg-accent text-black flex items-center justify-center text-xs font-bold -ml-3.5">
                    50+
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-card-foreground-muted transition-transform duration-500 ease-out group-hover:scale-105">
                <span className="text-xs font-medium">Filtered across 50+ languages</span>
              </div>
            </motion.div>

            {/* Card 4: Built to Scale matching template */}
            <motion.div
              {...cardVariant}
              className="group bg-card-primary rounded-4xl p-6 md:p-8 flex flex-col min-h-64"
            >
              <div className="mb-auto transition-transform duration-500 ease-out group-hover:scale-105">
                <h3 className="text-xl md:text-2xl font-medium text-neutral-900 leading-tight mb-2">
                  Built to Scale
                </h3>
                <p className="text-neutral-700 text-sm">
                  Autonomous infrastructure that runs 24/7 on your schedule
                </p>
              </div>

              <div className="flex flex-col gap-2 mt-6 transition-transform duration-500 ease-out group-hover:scale-[1.02]">
                <div className="flex items-center justify-between bg-background rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚀</span>
                    <span className="text-foreground font-medium">Smart Connections</span>
                  </div>
                  <span className="text-black dark:text-neutral-900 text-sm font-medium">+100% mutual</span>
                </div>
                <div className="flex items-center justify-between bg-background rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <span className="text-foreground font-medium">99.9% Cache Hit</span>
                  </div>
                  <span className="text-black dark:text-neutral-900 text-sm font-medium">0 duplicate LLM calls</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
