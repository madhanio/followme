'use client';

import React from 'react';
import type { Repo } from '@/lib/types';

/* Axis label style — reuse inline */
const LABEL: React.CSSProperties = { fontSize: 11, fill: 'var(--muted)' } as never;

/* Chart card wrapper */
function ChartCard({ title, note, children }: {
  title: string; note?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r)', padding: '16px 20px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>{title}</span>
        {note && <span style={{ fontSize:11, color:'var(--muted)' }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}

export interface BandChartProps {
  repos: Repo[];
  isLoading?: boolean;
}

export default function BandChart({ repos, isLoading }: BandChartProps) {
  /* Exclude grade 0 (prefilter skip) and synthetic inbound rows (language === 'Profile') */
  const eligible = repos.filter(r =>
    (r.grade ?? 0) > 0 && r.language !== 'Profile' && r.followed === true
  );

  /* Grade bands 60-69, 70-79, 80-89, 90-100 (matching demo scale) */
  const bands = [
    { label: '60–69', min: 6, max: 6.9 },
    { label: '70–79', min: 7, max: 7.9 },
    { label: '80–89', min: 8, max: 8.9 },
    { label: '90+',   min: 9, max: 10 },
  ];

  const rows = bands.map(b => {
    const group = eligible.filter(r => (r.grade ?? 0) >= b.min && (r.grade ?? 0) <= b.max);
    const count = group.length;
    const backCount = group.filter(r => r.follow_back === true).length;
    const rate = count > 0 ? Math.round((backCount / count) * 100) : null;
    return { label: b.label, count, rate };
  });

  const firstValid = rows.find(r => r.rate !== null && r.rate > 0);
  const lastValid = [...rows].reverse().find(r => r.rate !== null);
  const comparisonText = (firstValid && lastValid && firstValid !== lastValid && lastValid.rate! > firstValid.rate!)
    ? `Profiles scoring ${lastValid.label} follow back ${(lastValid.rate! / firstValid.rate!).toFixed(1)}x as often as ${firstValid.label}.`
    : 'Comparison trends will calibrate dynamically as candidate sample size increases.';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r)',
      boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
      transition: 'background 0.25s ease, border-color 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px 0',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Follow-back by score</h2>
      </div>

      {isLoading ? (
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 28, borderRadius: 4, background: 'var(--hover)', animation: 'fm-pulse 1.6s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <>
          <div style={{ padding: '14px 18px 6px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rows.map(r => (
              <div
                key={r.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 40px',
                  gridTemplateAreas: '"l t v" ". n ."',
                  gap: '2px 10px',
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <span style={{ gridArea: 'l', color: 'var(--muted)', fontWeight: 500 }}>{r.label}</span>
                <span style={{ gridArea: 't', height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden', display: 'block' }}>
                  <i
                    style={{
                      display: 'block',
                      height: '100%',
                      borderRadius: 4,
                      background: 'var(--accent)',
                      width: `${r.rate || 0}%`,
                      transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
                    }}
                  />
                </span>
                <span style={{ gridArea: 'v', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                  {r.rate === null ? '—' : `${r.rate}%`}
                </span>
                <span style={{ gridArea: 'n', color: 'var(--faint)', fontSize: 12 }}>
                  {r.count} followed
                </span>
              </div>
            ))}
          </div>

          <p style={{ padding: '6px 18px 16px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.45 }}>
            {comparisonText} Based on {eligible.length} followed profiles.
          </p>
        </>
      )}
    </div>
  );
}
