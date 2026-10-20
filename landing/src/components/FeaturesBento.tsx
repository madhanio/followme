'use client';

import React from 'react';
import Image from 'next/image';
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
  Star,
  GitFork,
  Check,
} from 'lucide-react';

const easeBezier = [0.23, 1, 0.32, 1] as const;

// Real developers followed by agent from @madhanio's network
const REAL_FOLLOWED_PROFILES = [
  { login: 'saforem2', avatar: 'https://avatars.githubusercontent.com/u/5234251?v=4' },
  { login: 'Leeous', avatar: 'https://avatars.githubusercontent.com/u/6354807?v=4' },
  { login: 'hyperpolymath', avatar: 'https://avatars.githubusercontent.com/u/6759885?v=4' },
  { login: 'jacoobwang', avatar: 'https://avatars.githubusercontent.com/u/11434315?v=4' },
];

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
              <h3 className="text-2xl md:text-3xl font-medium text-neutral-900 leading-tight mb-2">
                Intelligent Profile Evaluation
              </h3>
              <p className="text-neutral-700 text-sm font-normal">
                AI grades code substance and architecture on a 1–100 scale
              </p>
            </div>

            {/* Device Phone Mockup with Clean Notch and Live Profile Score Card (No physical buttons) */}
            <div className="flex-1 flex justify-center items-end transition-transform duration-500 ease-out group-hover:scale-[1.02]">
              <div className="relative bg-white shadow-2xl border-neutral-900 overflow-hidden z-10 w-60 md:w-68 h-96 md:h-112 rounded-t-4xl border-6 border-b-0 ring-1 ring-black/10">
                {/* Dynamic Island Notch */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 bg-neutral-900 rounded-full z-20 top-2.5 w-20 h-5 flex items-center justify-end pr-2 gap-1.5"
                  aria-hidden="true"
                >
                  <div className="size-2 rounded-full bg-neutral-800" />
                  <div className="size-1.5 rounded-full bg-blue-950/60" />
                </div>

                {/* Phone Screen: Evaluated Profile (@madhanio) */}
                <div className="absolute inset-0 bg-white pt-10 px-4 text-neutral-900 flex flex-col justify-between pb-3">
                  {/* Header bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-2 border-b border-neutral-100 pb-1.5">
                      <span className="font-semibold text-neutral-800">Evaluated Profile</span>
                      <span className="font-mono text-[10px] bg-accent/30 text-black px-1.5 py-0.5 rounded font-bold">
                        AGENT VERIFIED
                      </span>
                    </div>

                    {/* User Profile Card */}
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="size-11 rounded-full border border-neutral-200 overflow-hidden shrink-0 bg-neutral-100 shadow-sm">
                        <Image
                          src="https://avatars.githubusercontent.com/u/131896187?v=4"
                          alt="Madhan Adepu"
                          width={44}
                          height={44}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-neutral-900 leading-none">Madhan Adepu</h4>
                          <span className="text-[11px] text-neutral-500 font-mono">@madhanio</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-1 line-clamp-1 leading-snug">
                          Building AI systems that actually work in prod.
                        </p>
                      </div>
                    </div>

                    {/* Mini GitHub stats row */}
                    <div className="grid grid-cols-3 gap-1.5 bg-neutral-50 rounded-xl p-2 border border-neutral-100 text-center mb-3">
                      <div>
                        <span className="font-bold text-neutral-900 block text-xs">10</span>
                        <span className="text-neutral-500 text-[10px] font-medium">Repos</span>
                      </div>
                      <div>
                        <span className="font-bold text-neutral-900 block text-xs">206</span>
                        <span className="text-neutral-500 text-[10px] font-medium">Followers</span>
                      </div>
                      <div>
                        <span className="font-bold text-neutral-900 block text-xs">152</span>
                        <span className="text-neutral-500 text-[10px] font-medium">Following</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Evaluation Inspector Card */}
                  <div className="bg-neutral-900 text-white rounded-2xl p-3 shadow-md">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-neutral-400">
                          LLM Evaluation Score
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl font-black text-accent">82</span>
                          <span className="text-[11px] font-bold text-neutral-400">/ 100</span>
                          <span className="ml-1.5 text-[9px] bg-accent/20 text-accent font-semibold px-1.5 py-0.5 rounded">
                            Qualified
                          </span>
                        </div>
                      </div>
                      <div className="size-6 rounded-full bg-accent/20 flex items-center justify-center">
                        <Check className="size-3.5 text-accent stroke-[3]" />
                      </div>
                    </div>

                    {/* Signal Breakdown */}
                    <div className="space-y-1 text-[10px] border-t border-neutral-800 pt-1.5">
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>Code Architecture</span>
                        <span className="font-mono font-bold text-white">85 / 100</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>Originality & Utility</span>
                        <span className="font-mono font-bold text-white">80 / 100</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>Action Taken</span>
                        <span className="font-bold text-accent">Followed & Starred</span>
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-neutral-800 flex items-center justify-between text-[9px] font-mono text-neutral-400">
                      <span>NVIDIA NIM</span>
                      <span>meta/llama-3.3-70b</span>
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
              <h3 className="text-xl md:text-2xl whitespace-nowrap font-medium text-white leading-tight mb-2">
                Rate-Limit Protection
              </h3>
              <p className="text-white/70 text-sm">
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

              {/* Status Phone Mockup (White Screen, Clean Chassis) */}
              <div className="relative bg-white shadow-2xl border-neutral-900 overflow-hidden z-10 w-44 md:w-48 h-64 md:h-72 rounded-3xl border-4 text-neutral-900 ring-1 ring-black/10">
                <div className="absolute left-1/2 -translate-x-1/2 bg-neutral-900 rounded-full z-10 top-2 w-16 h-4" aria-hidden="true" />
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
            {/* Card 3: Evaluated Over 3.9k+ Profiles */}
            <motion.div
              {...cardVariant}
              className="group bg-card-secondary rounded-4xl p-6 md:p-8 flex flex-col justify-between min-h-64"
            >
              <div className="transition-transform duration-500 ease-out group-hover:scale-105">
                <h3 className="text-xl md:text-2xl font-medium text-white leading-tight mb-1">
                  Evaluated Over
                </h3>
                <h3 className="text-xl md:text-2xl font-medium text-white leading-tight mb-3">
                  3.9k+ Profiles
                </h3>
              </div>
              <div className="my-auto transition-transform duration-500 ease-out group-hover:scale-105">
                <div className="flex items-center overflow-hidden py-1">
                  <div className="flex items-center">
                    {REAL_FOLLOWED_PROFILES.map((dev, i) => (
                      <div
                        key={dev.login}
                        title={`@${dev.login}`}
                        style={{ zIndex: 10 + i }}
                        className={`size-11 rounded-full border-2 border-white/40 overflow-hidden relative bg-neutral-800 ${
                          i > 0 ? '-ml-3.5' : ''
                        }`}
                      >
                        <Image
                          src={dev.avatar}
                          alt={dev.login}
                          width={44}
                          height={44}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                    <div
                      style={{ zIndex: 30 }}
                      className="size-11 rounded-full border-2 border-white/40 bg-accent text-black flex items-center justify-center text-xs font-bold -ml-3.5 shadow-sm relative"
                    >
                      +133
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 text-white/70 transition-transform duration-500 ease-out group-hover:scale-105">
                <span className="text-xs font-medium">87.5% organic follow-back rate</span>
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
                <p className="text-neutral-700/80 text-sm">
                  Autonomous infrastructure that runs 24/7 on your schedule
                </p>
              </div>

              <div className="flex flex-col gap-2.5 mt-6 transition-transform duration-500 ease-out group-hover:scale-[1.02]">
                <div className="flex items-center gap-3 bg-neutral-900 text-white rounded-xl px-4 py-3 shadow-sm">
                  <span className="text-base">🚀</span>
                  <span className="text-sm font-medium tracking-tight">717 Autonomous Cycles</span>
                </div>
                <div className="flex items-center gap-3 bg-neutral-900 text-white rounded-xl px-4 py-3 shadow-sm">
                  <span className="text-base">🛡️</span>
                  <span className="text-sm font-medium tracking-tight">0 Quota Violations</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
