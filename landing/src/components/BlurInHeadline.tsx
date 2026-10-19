'use client';

import React, { useRef, useState, useEffect } from 'react';

const STATEMENT =
  "Autonomous developer networking built for serious builders. FollowMe analyzes real code quality and repository READMEs with NVIDIA NIM LLMs, intelligently filtering out spam, stars deserving projects, and builds genuine mutual connections across your tech stack.";

export function BlurInHeadline() {
  const containerRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const words = STATEMENT.split(' ');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          const rect = el.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          // Trigger ONLY when text has genuinely reached the center of the user's viewport:
          // Unblur starts when rect.top crosses 45% of viewport height (just above center)
          // and finishes unblurring as it scrolls to 0% (top of viewport)
          const startTrigger = 0.45 * windowHeight;
          const endTrigger = 0.0 * windowHeight;

          const ratio = Math.min(1, Math.max(0, (startTrigger - rect.top) / (startTrigger - endTrigger)));
          setProgress(ratio);
          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Also listen to Lenis scroll event if window dispatches or on scroll
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  return (
    <section ref={containerRef} className="w-full bg-background px-6 py-28 relative">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
          <span>The FollowMe Philosophy</span>
        </div>
        <p className="text-3xl font-medium text-left leading-snug tracking-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-snug">
          {words.map((word, idx) => {
            const wordStart = idx / words.length;
            const wordEnd = wordStart + 1 / words.length;
            const wordProgress = Math.min(
              1,
              Math.max(0, (progress - wordStart) / (wordEnd - wordStart))
            );

            const isHighlight =
              word.toLowerCase().includes('nvidia') ||
              word.toLowerCase().includes('nim') ||
              word.toLowerCase().includes('quality') ||
              word.toLowerCase().includes('builders');

            return (
              <span
                key={idx}
                className={`mr-2 inline-block lg:mr-3 transition-all duration-75 ${
                  isHighlight && wordProgress > 0.7 ? 'text-accent font-semibold' : ''
                }`}
                style={{
                  opacity: 0.15 + 0.85 * wordProgress,
                  filter: `blur(${(1 - wordProgress) * 8}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
