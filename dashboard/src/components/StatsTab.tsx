import React, { useState } from 'react';
import { Download } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ProfileItem } from '@/lib/types';

export interface StatsTabProps {
  mounted: boolean;
  isDark: boolean;
  timeRange: 'TODAY' | '7D' | '30D' | 'ALL';
  setTimeRange: (range: 'TODAY' | '7D' | '30D' | 'ALL') => void;
  filteredSummary: {
    evaluated: number;
    followed: number;
    unfollowed: number;
    mutuals: number;
  };
  chartData: Array<{
    date: string;
    follows: number;
    unfollows: number;
    evaluations: number;
    avgGrade?: number;
    followingGrowth?: number;
  }>;
  statusDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  allProfiles: ProfileItem[];
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export function StatsTab({
  mounted,
  isDark,
  timeRange,
  setTimeRange,
  filteredSummary,
  chartData,
  statusDistribution,
  allProfiles,
  onExportCSV,
  onExportJSON,
}: StatsTabProps) {
  const [hoveredDonut, setHoveredDonut] = useState<{ name: string; value: number } | null>(null);

  // STEP 4 - Fix hydration flash with skeleton placeholder
  if (!mounted) {
    return (
      <div className="space-y-4 py-6">
        <div className="h-6 w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
        <div className="h-6 w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
        <div className="h-6 w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-startup-card">
      {/* Date toggle & Data Export toolbar */}
      <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 aura-shadow">
        <div className="flex items-center space-x-3 flex-wrap gap-2">
          <span className="text-xs font-bold text-[#1a1c1c] dark:text-[#f0f0f0] font-jakarta">Plot Historical Ranges:</span>
          <div className="flex bg-[#eeeeee] dark:bg-[#1a1a1a] p-1 rounded-full text-xs font-bold font-geist">
            {(['TODAY', '7D', '30D', 'ALL'] as const).map(range => (
              <button 
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  timeRange === range 
                    ? 'bg-[#e60023] text-white font-bold shadow-xs' 
                    : 'text-[#767676] hover:text-[#1a1c1c] dark:hover:text-[#f0f0f0]'
                }`}
              >
                {range === 'TODAY' ? 'Today' : range}
              </button>
            ))}
          </div>
        </div>

        {/* Data Export & Backup Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExportCSV}
            className="px-3.5 py-1.5 border border-[#dadada] dark:border-[#2a2a2a] bg-[#f9f9f9] dark:bg-[#1a1a1a] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[#1a1c1c] dark:text-[#f0f0f0] rounded-full text-xs font-bold font-geist transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Export CSV Report"
          >
            <Download className="h-3.5 w-3.5 text-[#e60023]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onExportJSON}
            className="px-3.5 py-1.5 border border-[#dadada] dark:border-[#2a2a2a] bg-[#f9f9f9] dark:bg-[#1a1a1a] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[#1a1c1c] dark:text-[#f0f0f0] rounded-full text-xs font-bold font-geist transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Export JSON Backup"
          >
            <Download className="h-3.5 w-3.5 text-blue-500" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* 4-Stat Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[24px] p-5 aura-shadow flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676]">Total Evaluated</span>
          <span className="text-2xl font-extrabold text-[#e60023] font-mono mt-1.5 leading-none">{filteredSummary.evaluated}</span>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[24px] p-5 aura-shadow flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676]">Total Followed</span>
          <span className="text-2xl font-extrabold text-[#e60023] font-mono mt-1.5 leading-none">{filteredSummary.followed}</span>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[24px] p-5 aura-shadow flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676]">Total Unfollowed</span>
          <span className="text-2xl font-extrabold text-[#e60023] font-mono mt-1.5 leading-none">{filteredSummary.unfollowed}</span>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-[24px] p-5 aura-shadow flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676]">Mutuals Found</span>
          <span className="text-2xl font-extrabold text-[#e60023] font-mono mt-1.5 leading-none">{filteredSummary.mutuals}</span>
        </div>
      </div>

      {/* Primary charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Action Line Chart */}
        <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow lg:col-span-2">
          <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Daily Agent Actions (Follows/Unfollows/Evaluations)</h3>
          <div className="h-[280px] w-full font-mono text-[10px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#222' : '#f0f0f0'} />
                <XAxis dataKey="date" stroke="#767676" tick={{ fontFamily: 'Inter', fontSize: 10 }} />
                <YAxis stroke="#767676" tick={{ fontFamily: 'Geist Mono', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontFamily: 'Geist', fontSize: 11 }} />
                <Line type="monotone" dataKey="follows" stroke="#e60023" name="Follows" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="unfollows" stroke="color-mix(in srgb, #e60023 50%, white)" name="Unfollows" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="evaluations" stroke="color-mix(in srgb, #e60023 80%, black)" name="Evaluations" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut status distribution with dynamic center text */}
        <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow relative flex flex-col justify-between">
          <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Profiles Status Shares</h3>
          
          <div className="h-[200px] w-full font-mono text-[10px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      onMouseEnter={() => setHoveredDonut(entry)}
                      onMouseLeave={() => setHoveredDonut(null)}
                      className="cursor-pointer transition-all duration-300 hover:opacity-80 outline-none"
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Interactive Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#767676] max-w-[90px] text-center truncate">
                {hoveredDonut ? hoveredDonut.name : 'Total Profiles'}
              </span>
              <span className="text-xl font-extrabold text-[#e60023] font-mono leading-none mt-1">
                {hoveredDonut ? hoveredDonut.value : allProfiles.length}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[10px] font-geist mt-3">
            {statusDistribution.map((entry, index) => (
              <div key={index} className="flex items-center space-x-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="font-bold text-[#1a1c1c] dark:text-[#f0f0f0]">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grouped Bar Chart follows vs unfollows */}
      <div className="bg-white dark:bg-[#111111] border border-[#dadada] dark:border-[#2a2a2a] rounded-xl p-5 aura-shadow">
        <h3 className="text-sm font-bold font-jakarta mb-4 text-[#1a1c1c] dark:text-[#f0f0f0]">Action Volumes Comparison (Follows vs Unfollows)</h3>
        <div className="h-[280px] w-full font-mono text-[10px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#222' : '#f0f0f0'} />
              <XAxis dataKey="date" stroke="#767676" tick={{ fontFamily: 'Inter', fontSize: 10 }} />
              <YAxis stroke="#767676" tick={{ fontFamily: 'Geist Mono', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: isDark ? '#111' : '#fff', border: '1px solid #dadada', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontFamily: 'Geist', fontSize: 11 }} />
              <Bar dataKey="follows" fill="#e60023" name="Follow Actions" radius={[4, 4, 0, 0]} />
              <Bar dataKey="unfollows" fill="color-mix(in srgb, #e60023 50%, white)" name="Unfollow Actions" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
