'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Play, GitBranch } from 'lucide-react';

const FAQS = [
  {
    question: 'How does FollowMe evaluate repositories using NVIDIA NIM?',
    answer:
      'FollowMe extracts repo READMEs, dependencies, and code structure, sending them to NVIDIA NIM (e.g. meta/llama-3.3-70b-instruct or groq models). The prompt evaluates code originality, utility, architecture quality, and documentation, returning a resilient 1–10 score while filtering out empty forks or tutorial clones.',
  },
  {
    question: 'Will this risk hitting GitHub rate limits?',
    answer:
      'No. FollowMe tracks remaining GitHub Core API and Search API quotas in real-time. If the remaining quota dips below 20%, operations are gracefully paused until the quota window resets.',
  },
  {
    question: 'How do grace periods work for non-mutual follows?',
    answer:
      'When FollowMe follows a peer developer, a grace period timer (default 7 days, configurable) begins. If the connection remains one-way after this period, FollowMe can gracefully unfollow them to maintain healthy account follow ratios, while permanently protecting any profiles you followed manually.',
  },
  {
    question: 'Where is my data stored?',
    answer:
      '100% on your own Supabase PostgreSQL database. No metrics, tokens, credentials, or repository scores are sent to any third-party servers.',
  },
  {
    question: 'Can I test it before self-hosting?',
    answer:
      'Yes! You can explore the interactive sandboxed demo dashboard at followme-demo.vercel.app with simulated repositories, profiles, and live metrics.',
  },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <section id="faq" className="w-full px-6 py-28 bg-background scroll-mt-36">
      <div className="mx-auto max-w-3xl">
        <div className="mb-14 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">
            Frequently Asked Questions
          </span>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Everything you need to know
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Have questions about self-hosting or AI evaluation logic?
          </p>

          <div className="mt-8 flex items-center justify-center">
            <button
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onClick={() => {
                navigator.clipboard.writeText('madhan.adepu9@gmail.com');
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className="relative inline-flex items-center justify-center rounded-xl bg-foreground px-6 py-2.5 text-sm font-semibold text-background transition-all duration-300 hover:bg-foreground/90 shadow-sm cursor-pointer min-w-36 h-10 overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="copied"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="flex items-center gap-2 text-accent"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span>Copied!</span>
                  </motion.span>
                ) : hovered ? (
                  <motion.span
                    key="hovered"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    <span>Copy Email</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="default"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                    <span>Email Us</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="cursor-pointer rounded-2xl bg-frame border border-border p-5 shadow-sm sm:p-6 transition-all hover:border-foreground/20"
              >
                <div className="flex w-full items-center justify-between gap-4 text-left">
                  <span className="text-base font-medium text-foreground sm:text-lg">
                    {faq.question}
                  </span>
                  <div className="shrink-0">
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-accent' : ''
                      }`}
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="pt-4 text-sm leading-relaxed text-muted-foreground sm:text-base border-t border-border/50 mt-4">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
