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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      translate="no"
      className="notranslate h-full antialiased"
      suppressHydrationWarning
      style={{
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  try {
    var m = document.cookie.match(/(?:^|; )fm-theme=([^;]*)/);
    var cookieTheme = m ? decodeURIComponent(m[1]) : null;
    var t = cookieTheme || localStorage.getItem('fm-theme') || localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (t === 'dark' || (t !== 'light' && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch(e) {}
})();
`}} />
        <meta name="google" content="notranslate" />
      </head>
      <body className="notranslate min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
