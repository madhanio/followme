import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SiteFrame } from '@/components/SiteFrame';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SmoothScroll } from '@/components/SmoothScroll';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://followme-landing.vercel.app'),
  title: 'FollowMe — Autonomous GitHub Discovery & AI Developer Networking',
  description:
    'Autonomous scout and LLM evaluation engine built for serious open source builders. Grades repositories with NVIDIA NIM (Llama 3.3 70B), filters spam, and organically grows developer networks.',
  keywords: [
    'GitHub automation',
    'developer networking',
    'NVIDIA NIM',
    'AI code evaluation',
    'open source',
    'Next.js 15',
    'autonomous agent',
  ],
  authors: [{ name: 'Madhan', url: 'https://github.com/madhanio' }],
  creator: 'Madhan',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://followme-landing.vercel.app',
    siteName: 'FollowMe',
    title: 'FollowMe — Autonomous GitHub Discovery & AI Developer Networking',
    description:
      'Autonomous scout and LLM evaluation engine built for serious open source builders. Grades repositories with NVIDIA NIM (Llama 3.3 70B) on a 1–100 scale.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'FollowMe AI Developer Platform Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FollowMe — Autonomous GitHub Discovery & AI Developer Networking',
    description:
      'Autonomous scout and LLM evaluation engine built for serious open source builders. Powered by NVIDIA NIM.',
    images: ['/og.png'],
    creator: '@madhan',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-black`}>
        {/* Lenis Smooth Scrolling Engine */}
        <SmoothScroll />

        {/* React Bits Signature Inset Outer Frame & Corners */}
        <SiteFrame />

        {/* Floating Curved Dynamic Header */}
        <Header />

        {/* Main Content Sections */}
        <main id="main-content" className="flex-1">
          {children}
        </main>

        {/* Floating Card CTA & Accent Footer */}
        <Footer />
      </body>
    </html>
  );
}
