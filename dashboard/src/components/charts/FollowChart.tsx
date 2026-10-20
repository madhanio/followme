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

export interface FollowChartProps {
  repos: Repo[];
  isLoading?: boolean;
}

export default function FollowChart({ repos, isLoading }: FollowChartProps) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  /* Last 30 days buckets */
  const today = new Date();
  const days = 30;
  const dayObjs: Date[] = [];
  const followed: number[] = [];
  const unfollowed: number[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    dayObjs.push(d);
    const key = d.toISOString().slice(0, 10);
    followed.push(repos.filter(r => r.followed && r.created_at?.slice(0, 10) === key).length);
    unfollowed.push(repos.filter(r => r.unfollowed && (r.followed_at?.slice(0, 10) === key || r.created_at?.slice(0, 10) === key)).length);
  }

  /* SVG dimensions matching demo */
  const W = 520, H = 170, PAD = { top: 12, right: 14, bottom: 26, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxY = Math.max(...followed, ...unfollowed, 5);

  const x = (i: number) => PAD.left + (i / (days - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - v / maxY) * innerH;

  const lineFol = followed.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaFol = `${lineFol} L${x(days - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const lineUnf = unfollowed.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const xTicks = [0, 7, 14, 21, 29];

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
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Last 30 days</h2>
        <div style={{ display: 'flex', gap: 16, color: 'var(--muted)', fontSize: 12.5 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <i style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px solid var(--accent)', verticalAlign: 'middle', marginRight: 6 }} />
            Followed
          </span>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <i style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px dashed var(--ink)', verticalAlign: 'middle', marginRight: 6 }} />
            Unfollowed
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', padding: '6px 14px 12px' }}>
        {isLoading ? (
          <div style={{
            width: '100%', height: 140, borderRadius: 6,
            background: 'var(--hover)',
            animation: 'fm-pulse 1.6s ease-in-out infinite',
          }} />
        ) : (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const px = ((e.clientX - rect.left) / rect.width) * W;
                const idx = Math.max(0, Math.min(29, Math.round(((px - PAD.left) / innerW) * 29)));
                setHoverIndex(idx);
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {/* Y gridlines */}
              {[0, Math.round(maxY / 2), maxY].map(v => (
                <g key={v}>
                  <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">
                    {v}
                  </text>
                </g>
              ))}

              {/* X axis labels */}
              {xTicks.map(i => (
                <text
                  key={i}
                  x={x(i)}
                  y={H - 6}
                  textAnchor={i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}
                  fontSize="11"
                  fill="var(--faint)"
                >
                  {dayObjs[i]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </text>
              ))}

              {/* Shaded Area */}
              <path d={areaFol} fill="var(--accent-tint)" />

              {/* Followed Line */}
              <path d={lineFol} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />

              {/* Unfollowed Dashed Line */}
              <path d={lineUnf} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeDasharray="4 4" strokeLinejoin="round" />

              {/* Hover Crosshair / Indicator */}
              {hoverIndex !== null && (
                <>
                  <line
                    x1={x(hoverIndex)}
                    y1={PAD.top}
                    x2={x(hoverIndex)}
                    y2={PAD.top + innerH}
                    stroke="var(--line-strong)"
                    strokeWidth={1}
                  />
                  <circle
                    cx={x(hoverIndex)}
                    cy={y(followed[hoverIndex])}
                    r={4}
                    fill="var(--accent)"
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                </>
              )}
            </svg>

            {/* Hover Tooltip */}
            {hoverIndex !== null && (
              <div style={{
                position: 'absolute',
                pointerEvents: 'none',
                background: 'var(--ink)',
                color: 'var(--surface)',
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 6,
                whiteSpace: 'nowrap',
                left: `${(x(hoverIndex) / W) * 100}%`,
                top: `${(y(followed[hoverIndex]) / H) * 100}%`,
                transform: 'translate(-50%, -120%)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                zIndex: 10,
              }}>
                <b>{dayObjs[hoverIndex]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</b>: {followed[hoverIndex]} followed, {unfollowed[hoverIndex]} unfollowed
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
