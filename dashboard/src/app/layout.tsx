import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FollowMe - GitHub AI Automation Dashboard',
  description: 'Automatically discover, grade, star, and follow trending GitHub repositories using NVIDIA NIM.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
      style={{
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      <body className="min-h-full bg-[#070708] text-slate-100 flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
