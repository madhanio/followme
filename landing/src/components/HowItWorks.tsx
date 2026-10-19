'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Search, BrainCircuit, Users, Terminal, Play } from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    title: 'Automated Discovery',
    description:
      'Scans recently pushed repositories across your tech stack with custom language and topic filters.',
  },
  {
    icon: BrainCircuit,
    title: 'NVIDIA NIM Evaluation',
    description:
      'Evaluates code quality, architecture, and READMEs on a scale of 1–10 to weed out empty forks or spam.',
  },
  {
    icon: Users,
    title: 'Smart Connection',
    description:
      'Stars deserving repositories and follows active peer developers with automated grace-period management.',
  },
];

export function HowItWorks() {
  const containerRef = useRef<HTMLElement>(null);
  const firstIconRef = useRef<HTMLDivElement>(null);
  const lastIconRef = useRef<HTMLDivElement>(null);
  const [lineTrackHeight, setLineTrackHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    function updateLineHeight() {
      if (firstIconRef.current && lastIconRef.current) {
        const firstRect = firstIconRef.current.getBoundingClientRect();
        const lastRect = lastIconRef.current.getBoundingClientRect();
        // Distance between center of first icon and center of last icon
        const firstCenterY = firstRect.top + firstRect.height / 2;
        const lastCenterY = lastRect.top + lastRect.height / 2;
        const distance = Math.max(0, lastCenterY - firstCenterY);
        setLineTrackHeight(distance);
      }
    }

    updateLineHeight();
    window.addEventListener('resize', updateLineHeight);
    return () => window.removeEventListener('resize', updateLineHeight);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.3', 'end 0.7'],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section ref={containerRef} id="how-it-works" className="relative w-full bg-background scroll-mt-28">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:gap-20">
        {/* Sticky Left Column */}
        <div className="lg:sticky lg:top-48 lg:h-fit lg:self-start">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            How it works
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-foreground/60">
            Autonomous scouting and LLM evaluation built for{' '}
            <span className="font-medium text-foreground">serious open source builders</span>, running 24/7 on your schedule.
          </p>

          <a
            href="https://followme-demo.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
          >
            Explore live demo
          </a>
        </div>

        {/* Timeline Right Column */}
        <div className="relative">
          <ol className="relative list-none p-0 m-0">
            {/* Single continuous line from center of 1st icon to center of last icon */}
            <div
              style={lineTrackHeight ? { height: `${lineTrackHeight}px` } : undefined}
              className={`absolute left-6 top-6 w-0.5 -translate-x-1/2 bg-foreground/10 pointer-events-none ${
                lineTrackHeight === null ? 'bottom-20' : ''
              }`}
              aria-hidden="true"
            >
              <motion.div
                style={{ height: lineHeight, willChange: 'height' }}
                className="w-full bg-accent origin-top"
              />
            </div>

            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isFirst = idx === 0;
              const isLast = idx === STEPS.length - 1;
              return (
                <li key={idx} className="relative">
                  <div className={`relative flex gap-5 ${isLast ? 'pb-8 sm:pb-12' : 'pb-40 md:pb-52'}`}>
                    <div
                      ref={isFirst ? firstIconRef : isLast ? lastIconRef : undefined}
                      className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent"
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5 text-black" strokeWidth={2} />
                    </div>
                    <div className="pt-1">
                      <h3 className="text-xl font-semibold text-foreground sm:text-2xl">
                        {step.title}
                      </h3>
                      <p className="mt-2 max-w-sm text-base leading-relaxed text-foreground/60">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
