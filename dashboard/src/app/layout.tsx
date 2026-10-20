import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'FollowMe - GitHub AI Automation Dashboard',
  description: 'Automatically discover, grade, star, and follow trending GitHub repositories using NVIDIA NIM.',
  other: {
    google: 'notranslate',
  },
};

import { cookies } from 'next/headers';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get('fm-theme')?.value || cookieStore.get('theme')?.value;
  const isServerDark = cookieTheme === 'dark';

  return (
    <html
      lang="en"
      translate="no"
      className={`notranslate h-full antialiased ${isServerDark ? 'dark' : ''}`}
      suppressHydrationWarning
      style={{
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        colorScheme: isServerDark ? 'dark' : 'light',
      }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  try {
    var m = document.cookie.match(/(?:^|; )fm-theme=([^;]*)/) || document.cookie.match(/(?:^|; )theme=([^;]*)/);
    var cookieTheme = m ? decodeURIComponent(m[1]) : null;
    var t = cookieTheme || localStorage.getItem('fm-theme') || localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = t === 'dark' || (!t && prefersDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  } catch(e) {}
})();
`}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="google" content="notranslate" />
      </head>
      <body className="notranslate min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
