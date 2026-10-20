'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDownRight, Menu, X, Sparkles, GitBranch, Play } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed shadow-2xl/20 rounded-b-4xl top-2.5 left-1/2 -translate-x-1/2 w-full max-w-5xl max-[1200px]:max-w-2xl bg-frame z-9998 max-[850px]:top-0 max-[850px]:left-0 max-[850px]:right-0 max-[850px]:translate-x-0 max-[850px]:w-full max-[850px]:max-w-none max-[850px]:rounded-none max-[850px]:rounded-b-4xl max-[850px]:overflow-hidden transition-all duration-300">
      <div className="h-20 max-[850px]:h-18 flex items-center justify-between px-6 max-[850px]:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-7 h-7 flex items-center justify-center">
            {/* White logo for dark mode */}
            <Image
              src="/logo-white-cropped.png"
              alt="FollowMe Logo"
              width={28}
              height={28}
              className="hidden dark:block object-contain transition-transform group-hover:scale-105"
            />
            {/* Black logo for light mode */}
            <Image
              src="/logo-black-cropped.png"
              alt="FollowMe Logo"
              width={28}
              height={28}
              className="block dark:hidden object-contain transition-transform group-hover:scale-105"
            />
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">
            FollowMe
          </span>
        </Link>

        {/* Center Nav - Minimal, clean like template */}
        <nav className="flex items-center gap-1 max-[850px]:hidden">
          <a
            href="#features"
            className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5"
          >
            How it works
          </a>
          <a
            href="#faq"
            className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5"
          >
            FAQ
          </a>
        </nav>

        {/* Action CTAs */}
        <div className="flex items-center gap-4 max-[850px]:hidden">
          <a
            href="https://github.com/madhanio/followme"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-foreground/70 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5"
            title="GitHub Repository"
            aria-label="GitHub Repository"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>

          {/* Try Demo Button with signature ReactBits offset accent */}
          <a
            href="https://followme-demo.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center"
          >
            <span className="absolute right-0 inset-y-0 w-[calc(100%-1.5rem)] rounded-xl bg-accent" />
            <span className="relative z-10 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-medium">
              Try Demo
            </span>
            <span className="relative -left-px z-10 w-9 h-9 rounded-xl flex items-center justify-center text-black">
              <ArrowDownRight className="w-4 h-4 transition-transform duration-300 group-hover:-rotate-45" />
            </span>
          </a>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="hidden max-[850px]:flex items-center justify-center w-10 h-10 text-foreground"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Floating Ear Outlines on Left & Right for Inverted Inset Effect */}
      <svg
        className="absolute top-0 -left-12.25 rotate-180 text-frame pointer-events-none max-[850px]:hidden"
        width="50"
        height="50"
        viewBox="0 0 50 50"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z"
          fill="currentColor"
        />
      </svg>
      <svg
        className="absolute top-0 -right-12.25 rotate-90 text-frame pointer-events-none max-[850px]:hidden"
        width="50"
        height="50"
        viewBox="0 0 50 50"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z"
          fill="currentColor"
        />
      </svg>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="hidden max-[850px]:flex flex-col p-6 bg-frame border-t border-foreground/10 space-y-4">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-medium text-foreground py-1"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-medium text-foreground py-1"
          >
            How it works
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-medium text-foreground py-1"
          >
            FAQ
          </a>
          <div className="pt-4 flex flex-col gap-3">
            <a
              href="https://followme-demo.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 bg-accent text-black font-semibold rounded-xl text-sm"
            >
              Try Live Demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
