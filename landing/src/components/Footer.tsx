'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, GitBranch, Play, Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative pt-36 mt-20 mx-2.5 max-[850px]:mx-0">
      {/* Floating Call to Action Card with Inset Wallpaper Texture */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-full max-w-5xl px-4">
        <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl/20 border border-foreground/10">
          <div
            className="absolute inset-0 bg-center bg-no-repeat brightness-125 dark:brightness-50 blur-sm scale-110"
            style={{ backgroundImage: 'url(/BG.jpg)', backgroundSize: '150%' }}
            aria-hidden="true"
          />
          <div className="relative z-10 flex flex-col items-center text-center px-8 py-20 max-[850px]:px-6 max-[850px]:py-12 bg-background/50 backdrop-blur-md">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/20 text-accent font-semibold text-xs mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Creator & Architecture
            </div>
            <h2 className="text-5xl max-[850px]:text-3xl text-foreground font-semibold tracking-tight max-w-2xl mb-4">
              Meet the developer behind FollowMe
            </h2>
            <p className="text-foreground/70 text-base max-w-xl mb-8 leading-relaxed">
              Crafted by Madhan — exploring autonomous agents, scalable developer tooling, and modern distributed systems.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://github.com/madhanio"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all shadow-md"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub Profile
              </a>
              <a
                href="https://madhanio.github.io"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-background border border-foreground/20 text-foreground text-sm font-semibold hover:bg-foreground/5 transition-all shadow-sm group"
              >
                <span>Visit Portfolio</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Accent Footer Block */}
      <div className="bg-accent rounded-tr-[3rem] rounded-tl-[3rem] pt-84 pb-16 max-[850px]:pt-72 text-neutral-900">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
            {/* Left Brand Column */}
            <div className="md:col-span-6">
              <Link href="/" className="inline-flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center p-1.5">
                  <Image
                    src="/logo-white-cropped.png"
                    alt="FollowMe Logo"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <span className="text-xl font-bold tracking-tight text-neutral-900">
                  FollowMe
                </span>
              </Link>
              <p className="mt-4 text-sm text-neutral-800/80 max-w-sm leading-relaxed font-normal">
                Autonomous GitHub profile discovery, NVIDIA NIM LLM evaluation, and developer networking for serious builders.
              </p>
            </div>

            {/* Right Columns: Navigation + Ecosystem */}
            <div className="md:col-span-6 grid grid-cols-2 gap-8 sm:gap-12 md:justify-items-end">
              {/* Navigation */}
              <div className="flex flex-col">
                <h3 className="text-xs font-bold text-neutral-900/60 uppercase tracking-wider mb-4">
                  Navigation
                </h3>
                <ul className="space-y-2.5 text-sm font-medium">
                  <li>
                    <a href="#features" className="text-neutral-800 hover:text-black transition-colors">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#how-it-works" className="text-neutral-800 hover:text-black transition-colors">
                      How it works
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="text-neutral-800 hover:text-black transition-colors">
                      FAQ
                    </a>
                  </li>
                </ul>
              </div>

              {/* Ecosystem - Clean text links matching Navigation */}
              <div className="flex flex-col">
                <h3 className="text-xs font-bold text-neutral-900/60 uppercase tracking-wider mb-4">
                  Ecosystem
                </h3>
                <ul className="space-y-2.5 text-sm font-medium">
                  <li>
                    <a
                      href="https://followme-demo.vercel.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-800 hover:text-black transition-colors"
                    >
                      Live Demo
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/madhanio/followme"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-800 hover:text-black transition-colors"
                    >
                      GitHub Repository
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/madhanio/followme/blob/main/LICENSE"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-800 hover:text-black transition-colors"
                    >
                      MIT License
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-16 pt-6 border-t border-neutral-900/10 flex flex-col sm:flex-row items-center justify-center text-center text-xs text-neutral-900/70 gap-2">
            <p>
              © {new Date().getFullYear()} FollowMe — Open source under MIT
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
