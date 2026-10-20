'use client';

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { ArrowDownRight, Sparkles, Star, Terminal, Play, ShieldCheck } from 'lucide-react';

const TECH_LOGOS = [
  {
    name: 'GitHub',
    svg: (
      <svg className="h-7 w-auto fill-current" viewBox="0 0 24 24">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    name: 'Vercel',
    svg: (
      <svg className="h-6 w-auto fill-current" viewBox="0 0 1155 1000">
        <path d="m577.346 0 577.346 1000H0z" />
      </svg>
    ),
  },
  {
    name: 'Supabase',
    svg: (
      <svg className="h-7 w-auto fill-current" viewBox="0 0 109 113">
        <path d="M63.7076 110.284C60.848 113.885 55.0243 111.977 54.8406 107.385L52.8754 58.2838H99.4216C107.697 58.2838 112.551 67.5746 107.876 74.3725L63.7076 110.284Z" />
        <path d="M45.717 2.01666C48.5766 -1.58379 54.4003 0.32403 54.584 4.91605L55.7513 54.0175H10.0031C1.72776 54.0175 -3.12649 44.7266 1.54877 37.9287L45.717 2.01666Z" opacity="0.6" />
      </svg>
    ),
  },
  {
    name: 'Render',
    svg: (
      <svg className="h-7 w-auto fill-current" viewBox="0 0 24 24">
        <path d="M19.053 7.828v7.838a1.597 1.597 0 0 1-1.596 1.596h-4.321v-4.832a2.404 2.404 0 0 0-2.405-2.405H5.899V5.197a1.597 1.597 0 0 1 1.596-1.596h10.963a1.597 1.597 0 0 1 1.596 1.596v2.631h-.001zm-9.923 9.434h-1.8v-4.832c0-.332.27-.601.601-.601h1.2v5.433h-.001zm-3.23 0H4.099a1.597 1.597 0 0 1-1.596-1.596v-3.236h3.397v4.832zm14.1 3.141H3.999a.4.4 0 0 1-.4-.4v-.341a4.004 4.004 0 0 1 4-4.005h3.132c.221 0 .4-.179.4-.4v-4.032a4.808 4.808 0 0 1 4.808-4.808h4.061a.4.4 0 0 1 .4.4v13.186a.4.4 0 0 1-.4.4z" />
      </svg>
    ),
  },
  {
    name: 'Docker',
    svg: (
      <svg className="h-7 w-auto fill-current" viewBox="0 0 24 24">
        <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H2.208a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m21.604 1.583c-.347-.234-.845-.347-1.464-.347-.393 0-.825.048-1.28.143-.377-.736-1.026-1.328-1.782-1.637-.194-.078-.396-.134-.606-.168a.19.19 0 00-.168.046.187.187 0 00-.056.166c.21 1.05.088 1.956-.37 2.7-.306.495-.767.876-1.332 1.111l-.856.357H1.365a.186.186 0 00-.185.186c0 1.95.498 3.738 1.48 5.319 1.161 1.87 2.822 3.25 4.935 4.102 1.634.66 3.424.995 5.321.995 2.14 0 4.135-.41 5.93-1.218 2.052-.924 3.633-2.38 4.698-4.329.544-.995.897-2.185 1.05-3.535a.187.187 0 00-.057-.152z" />
      </svg>
    ),
  },
  {
    name: 'Next.js',
    svg: (
      <svg className="h-6 w-auto fill-current" viewBox="0 0 180 180">
        <path fill="currentColor" fillRule="evenodd" d="M90 180c49.706 0 90-40.294 90-90s-40.294-90-90-90C40.294 0 0 40.294 0 90s40.294 90 90 90Zm39.314-119.863c.484 0 .877.393.877.877v57.972a.877.877 0 0 1-1.754 0V65.81c0-.484.393-.873.877-.873Zm-48.428.026c.484 0 .877.393.877.877v47.962l40.407-52.062a.877.877 0 0 1 1.39.227 89.92 89.92 0 0 1 8.877 12.355L87.525 125.75l-4.945-6.398-1.694-2.19V61.04c0-.484.393-.877.877-.877H80.886Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  // 3D Parallax spring physics from template
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || window.innerWidth < 850) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const normX = (e.clientX - centerX) / (rect.width / 2);
    const normY = (e.clientY - centerY) / (rect.height / 2);
    mouseX.set(normX * 18);
    mouseY.set(normY * 18);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const easeBezier = [0.23, 1, 0.32, 1] as const;
  const fadeUp = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
  };

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="flex flex-col relative overflow-hidden"
      style={{ colorScheme: 'light' }}
    >
      {/* Background with 3D Mouse Tilt Parallax - High brightness light wallpaper */}
      <motion.div
        className="absolute inset-0 min-[850px]:inset-2.5 bg-cover bg-center bg-no-repeat -z-10 brightness-125 rounded-br-4xl rounded-bl-4xl min-[850px]:scale-105"
        style={{
          backgroundImage: 'url(/BG.jpg)',
          x: springX,
          y: springY,
        }}
        aria-hidden="true"
      />

      {/* Hero Headline Content */}
      <div className="flex items-start justify-center px-6 pt-64 pb-12 max-[850px]:pt-32">
        <motion.div
          className="flex flex-col items-center max-[850px]:items-start text-center max-[850px]:text-left max-w-4xl max-[850px]:w-full"
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.15, delayChildren: 0.2 }}
        >
          {/* Eyebrow Badge */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.8, ease: easeBezier }}
            className="inline-flex items-center gap-1.5 pl-4 pr-3 py-1.5 rounded-xl border border-black/10 bg-white text-black text-sm font-medium mb-6 shadow-sm"
          >
            <span>100% Open Source</span>
            <span className="text-accent">✦</span>
          </motion.div>

          {/* Main Title - 2 punchy lines */}
          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.8, ease: easeBezier }}
            className="text-8xl max-[1000px]:text-6xl max-[850px]:text-5xl font-medium tracking-tight leading-[1.1] mb-6 text-black"
          >
            <motion.span className="block" variants={fadeUp} transition={{ duration: 0.8, ease: easeBezier }}>
              Build Network
            </motion.span>
            <motion.span className="block" variants={fadeUp} transition={{ duration: 0.8, ease: easeBezier }}>
              Ship with <span className="italic font-serif text-accent">Confidence</span>
            </motion.span>
          </motion.h1>

          {/* Subtitle - Single crisp sentence */}
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.8, ease: easeBezier }}
            className="text-lg text-neutral-600 mb-8 max-w-xl"
          >
            Autonomous repository discovery and LLM evaluation for builders who want to grow organically
          </motion.p>

          {/* Call to Action Buttons */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.8, ease: easeBezier }}
            className="flex items-center justify-center gap-3.5 max-[850px]:flex-col max-[850px]:w-full"
          >
            {/* Primary Accent Button */}
            <a
              href="https://followme-demo.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative cursor-pointer inline-flex items-center max-[850px]:w-full"
            >
              <span className="absolute right-0 inset-y-0 w-[calc(100%-2rem)] max-[850px]:w-full rounded-xl bg-accent" />
              <span className="relative z-10 px-6 py-3 rounded-xl bg-black text-white font-medium max-[850px]:flex-1">
                Try Live Demo
              </span>
              <span className="relative -left-px z-10 w-11 h-11 rounded-xl flex items-center justify-center text-black">
                <ArrowDownRight className="w-5 h-5 transition-transform duration-300 group-hover:-rotate-45" />
              </span>
            </a>

            {/* Secondary Clean Outline Button */}
            <a
              href="https://github.com/madhanio/followme#quick-start-docker-compose"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-black/15 bg-white/70 hover:bg-white text-black font-medium transition-all duration-200 shadow-sm hover:shadow hover:border-black/30 max-[850px]:w-full"
            >
              <svg className="w-4 h-4 fill-current transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>View on GitHub</span>
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* Dashboard Preview Image with Invert/Mix-blend and Fading Gradient Mask */}
      <motion.div
        className="relative px-6 mt-24 max-[850px]:mt-10"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.6, ease: easeBezier }}
      >
        <div className="relative max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-neutral-200 shadow-2xl/5 mask-[linear-gradient(to_bottom,black_50%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
            <Image
              src="/dashboardmock.png"
              alt="Dashboard preview"
              width={1920}
              height={1080}
              priority
              className="w-full h-auto contrast-110"
            />
          </div>
        </div>
      </motion.div>

      {/* Full-bleed Infinite Horizontal Logo Marquee */}
      <div className="w-full pt-20 pb-12 overflow-hidden">
        <div className="relative w-full overflow-x-hidden mask-[linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
          <div className="flex w-max animate-marquee space-x-20 sm:space-x-24 select-none items-center">
            {[...TECH_LOGOS, ...TECH_LOGOS, ...TECH_LOGOS, ...TECH_LOGOS].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3.5 text-neutral-900 transition-all duration-300 cursor-pointer"
                title={item.name}
              >
                <div className="h-9 w-auto flex items-center justify-center [&>svg]:h-7 [&>svg]:w-auto [&>svg]:fill-neutral-900">
                  {item.svg}
                </div>
                <span className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap text-neutral-900">
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
