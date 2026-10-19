'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TESTIMONIALS = [
  {
    quote:
      'FollowMe completely streamlined how our open source projects discover peer developers. Our repository stars and mutual followback ratios doubled within weeks.',
    name: 'David Miller',
    title: 'Maintainer @ RustHyper & TypeScript Builder',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face',
    initials: 'DM',
    color: '#a8d946',
  },
  {
    quote:
      'The NVIDIA NIM evaluation is insanely accurate. It filters out spam and forks automatically, so I only ever connect with genuine indie hackers and builders.',
    name: 'Sarah Chen',
    title: 'Full Stack Engineer & OSS Contributor',
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face',
    initials: 'SC',
    color: '#a8d946',
  },
  {
    quote:
      'The 7-day grace period cleanup engine is pure genius. No more bloated following counts or one-way connections. Everything runs quietly on Docker.',
    name: 'Alex Rivera',
    title: 'DevOps & Infrastructure Lead',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
    initials: 'AR',
    color: '#a8d946',
  },
];

export function Testimonials() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="w-full bg-frame border-t border-b border-accent/15 px-6 py-28 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-14 text-4xl leading-tight font-medium text-neutral-900 sm:text-5xl lg:mb-16 lg:text-6xl dark:text-neutral-50"
        >
          Trusted by builders worldwide
        </motion.h2>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          {/* Avatar Tabs with Animated Progress Ring */}
          <div className="flex items-center justify-start gap-4 lg:gap-6" role="tablist">
            {TESTIMONIALS.map((item, idx) => {
              const isSelected = activeIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  className="relative cursor-pointer"
                  role="tab"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                >
                  <div
                    className={`relative flex h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20 items-center justify-center overflow-hidden rounded-full transition-all duration-500 ${
                      isSelected ? 'ring-2 ring-accent scale-105' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0'
                    }`}
                    style={{ backgroundColor: isSelected ? item.color : undefined }}
                  >
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Circular SVG Progress Ring for active avatar */}
                  {isSelected && (
                    <svg
                      className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] -rotate-90 pointer-events-none"
                      viewBox="0 0 100 100"
                      aria-hidden="true"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="48"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="1.5"
                        opacity="0.2"
                      />
                      <motion.circle
                        key={`ring-${activeIdx}`}
                        cx="50"
                        cy="50"
                        r="48"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="1.5"
                        strokeDasharray={`${2 * Math.PI * 48}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 48 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 8, ease: 'linear' }}
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* Testimonial Quote Panel */}
          <div className="flex flex-col justify-center min-h-40">
            <AnimatePresence mode="wait">
              {TESTIMONIALS[activeIdx] && (
                <motion.div
                  key={activeIdx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <blockquote className="mb-6 text-xl leading-relaxed text-neutral-700 dark:text-neutral-300">
                    “{TESTIMONIALS[activeIdx].quote}”
                  </blockquote>
                  <div className="text-base font-medium text-neutral-900 sm:text-lg dark:text-neutral-100">
                    {TESTIMONIALS[activeIdx].name},{' '}
                    <span className="text-neutral-600 dark:text-neutral-400 font-normal">
                      {TESTIMONIALS[activeIdx].title}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
