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

export interface BandChartProps { repos: Repo[] }

export default function BandChart({ repos }: BandChartProps) {
  /* Exclude grade 0 (prefilter skip) and synthetic inbound rows (language === 'Profile') */
  const eligible = repos.filter(r =>
    (r.grade ?? 0) > 0 && r.language !== 'Profile'
  );

  /* Grade bands 1-10 */
  const BANDS = [1,2,3,4,5,6,7,8,9,10];

  interface BandRow {
    grade: number;
    total: number;
    followBack: number;
    pct: number;
  }

  const rows: BandRow[] = BANDS.map(g => {
    const total     = eligible.filter(r => r.grade === g).length;
    const followBack = eligible.filter(r => r.grade === g && r.follow_back === true).length;
    return { grade: g, total, followBack, pct: total > 0 ? followBack / total : 0 };
  }).filter(r => r.total > 0);   /* hide empty bands */

  /* SVG bar chart */
  const W = 480, H = 160, PAD = { top:8, right:8, bottom:32, left:36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxTotal = Math.max(...rows.map(r => r.total), 1);

  const bandW = rows.length > 0 ? innerW / rows.length : innerW;
  const barW  = Math.max(bandW * 0.55, 6);

  function barX(i: number) { return PAD.left + i * bandW + (bandW - barW) / 2; }
  function barH(v: number) { return (v / maxTotal) * innerH; }
  function barY(v: number) { return PAD.top + innerH - barH(v); }

  const n = eligible.length;

  return (
    <ChartCard title="Score Band vs Follow-back" note={`n=${n}, score 0 + synthetic excluded`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', overflow:'visible' }}>

        {/* Y gridlines */}
        {[0.25, 0.5, 0.75, 1].map(f => {
          const y = PAD.top + innerH - f * innerH;
          return (
            <g key={f}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end"
                style={{ fontSize:10, fill:'var(--muted)' } as never}>
                {Math.round(maxTotal * f)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {rows.map((row, i) => (
          <g key={row.grade}>
            {/* Total bar (background, faint) */}
            <rect
              x={barX(i)} y={barY(row.total)}
              width={barW} height={barH(row.total)}
              rx={3}
              fill="var(--accent-tint)"
              stroke="var(--line)" strokeWidth={1}
            />
            {/* Follow-back bar (overlay, solid) */}
            {row.followBack > 0 && (
              <rect
                x={barX(i)} y={barY(row.followBack)}
                width={barW} height={barH(row.followBack)}
                rx={3}
                fill="var(--accent)"
              />
            )}
            {/* Grade label */}
            <text x={barX(i) + barW / 2} y={H - PAD.bottom + 14}
              textAnchor="middle"
              style={{ fontSize:10, fill:'var(--muted)' } as never}>
              {row.grade * 10}
            </text>
            {/* Pct label above bar */}
            {row.pct > 0 && (
              <text x={barX(i) + barW / 2} y={barY(row.total) - 3}
                textAnchor="middle"
                style={{ fontSize:9, fill:'var(--faint)' } as never}>
                {(row.pct * 100).toFixed(0)}%
              </text>
            )}
          </g>
        ))}

        {/* X axis label */}
        <text x={PAD.left + innerW / 2} y={H - 2}
          textAnchor="middle"
          style={{ fontSize:10, fill:'var(--muted)' } as never}>
          Score (10–100)
        </text>

        {/* Legend */}
        <g transform={`translate(${W - PAD.right - 120}, ${PAD.top})`}>
          <rect width={12} height={10} rx={2} fill="var(--accent-tint)" stroke="var(--line)" strokeWidth={1}/>
          <text x={16} y={9} style={{ fontSize:10, fill:'var(--muted)' } as never}>Total</text>
          <rect y={14} width={12} height={10} rx={2} fill="var(--accent)"/>
          <text x={16} y={23} style={{ fontSize:10, fill:'var(--muted)' } as never}>Followed back</text>
        </g>

      </svg>
    </ChartCard>
  );
}
