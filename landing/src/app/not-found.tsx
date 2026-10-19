import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">404</h2>
      <p className="mt-4 text-lg text-foreground/60">Page not found</p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
      >
        Return Home
      </Link>
    </div>
  );
}
