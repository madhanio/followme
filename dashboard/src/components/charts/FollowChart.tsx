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

export interface FollowChartProps { repos: Repo[] }

export default function FollowChart({ repos }: FollowChartProps) {
  /* Last 30 days buckets */
  const today = new Date();
  const days = 30;
  const labels: string[] = [];
  const followed: number[] = [];
  const unfollowed: number[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    labels.push(i % 7 === 0 ? d.toLocaleDateString('en', { month:'short', day:'numeric' }) : '');
    followed.push(repos.filter(r => r.followed && r.created_at?.slice(0,10) === key).length);
    unfollowed.push(repos.filter(r => r.unfollowed && (r.followed_at?.slice(0,10) === key || r.created_at?.slice(0,10) === key)).length);
  }

  /* SVG dimensions */
  const W = 480, H = 140, PAD = { top:8, right:8, bottom:24, left:28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxY = Math.max(...followed, ...unfollowed, 1);

  function toX(i: number) { return PAD.left + (i / (days - 1)) * innerW; }
  function toY(v: number) { return PAD.top + innerH - (v / maxY) * innerH; }

  function line(arr: number[]) {
    return arr.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  }

  const n = repos.filter(r => r.followed || r.unfollowed).length;

  return (
    <ChartCard title="30-day Follow Activity" note={`n=${n}`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', overflow:'visible' }}>

        {/* Y gridlines (3 lines) */}
        {[0.25, 0.5, 0.75, 1].map(f => {
          const y = PAD.top + innerH - f * innerH;
          return (
            <g key={f}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end"
                style={{ fontSize:10, fill:'var(--muted)' } as never}>
                {Math.round(maxY * f)}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {labels.map((l, i) => l && (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle"
            style={{ fontSize:10, fill:'var(--muted)' } as never}>
            {l}
          </text>
        ))}

        {/* Unfollowed line (behind) */}
        <polyline points={line(unfollowed)} fill="none"
          stroke="var(--warn)" strokeWidth={1.5}
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Followed line (front) */}
        <polyline points={line(followed)} fill="none"
          stroke="var(--accent)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Legend */}
        <circle cx={PAD.left} cy={H - 2} r={0} /> {/* spacer */}
        <g transform={`translate(${W - PAD.right - 120}, ${PAD.top})`}>
          <line x1={0} y1={6} x2={14} y2={6} stroke="var(--accent)" strokeWidth={2} />
          <text x={18} y={10} style={{ fontSize:10, fill:'var(--muted)' } as never}>Followed</text>
          <line x1={0} y1={20} x2={14} y2={20} stroke="var(--warn)" strokeWidth={1.5} />
          <text x={18} y={24} style={{ fontSize:10, fill:'var(--muted)' } as never}>Unfollowed</text>
        </g>

      </svg>
    </ChartCard>
  );
}
