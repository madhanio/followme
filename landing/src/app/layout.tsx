import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SiteFrame } from '@/components/SiteFrame';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SmoothScroll } from '@/components/SmoothScroll';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FollowMe — Autonomous GitHub Repo Discovery & AI Developer Networking',
  description:
    'Discover quality emerging projects in your stack, evaluate code with NVIDIA NIM LLMs, star standout repos, and grow your developer network organically.',
  openGraph: {
    title: 'FollowMe — Autonomous GitHub Repo Discovery & AI Developer Networking',
    description:
      'Discover quality emerging projects in your stack, evaluate code with NVIDIA NIM LLMs, star standout repos, and grow your developer network organically.',
    images: ['/dashboardmock.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FollowMe — Autonomous GitHub Repo Discovery & AI Developer Networking',
    description:
      'Discover quality emerging projects in your stack, evaluate code with NVIDIA NIM LLMs, star standout repos, and grow your developer network organically.',
    images: ['/dashboardmock.png'],
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
