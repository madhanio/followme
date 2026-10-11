import Header from '@/components/Header';

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <Header
        status="idle"
        lastRunLabel={null}
        onRunNow={() => {}}
        onPause={() => {}}
        onUnpause={() => {}}
        onUnfollowOpen={() => {}}
        onSettingsOpen={() => {}}
      />
      <main
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {[88, 220, 400, 120].map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              borderRadius: 'var(--r)',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              animation: 'pulse 1.6s ease-in-out infinite',
            }}
          />
        ))}
      </main>
    </div>
  );
}
