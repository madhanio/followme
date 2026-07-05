'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { triggerWorker } from './actions';
import { 
  Search, 
  Filter, 
  Play, 
  RotateCw, 
  Star, 
  UserPlus, 
  Terminal, 
  BookOpen, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Code
} from 'lucide-react';

const Github = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const cleanSnippet = (text: string) => {
  if (!text) return '';
  // Strip HTML tags using regex
  return text.replace(/<[^>]*>/g, '').trim();
};

interface Repo {
  id: number;
  github_url: string;
  owner: string;
  name: string;
  stars: number;
  language: string;
  topics: string[];
  readme_snippet: string;
  grade: number;
  graded_at: string;
  followed?: boolean;
  starred?: boolean;
  followed_at?: string;
  follow_back?: boolean;
  unfollowed?: boolean;
}

interface Log {
  id: number;
  action: string;
  repo_id: number | null;
  timestamp: string;
  status: string;
  message: string;
}

interface DashboardViewProps {
  initialRepos: Repo[];
  initialLogs: Log[];
}

export default function DashboardView({ initialRepos, initialLogs }: DashboardViewProps) {
  const router = useRouter();
  
  // Interactive filters
  const [searchTerm, setSearchTerm] = useState('');
  const [minGrade, setMinGrade] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [followedFilter, setFollowedFilter] = useState<'All' | 'Yes' | 'No' | 'Unfollowed'>('All');
  const [starredFilter, setStarredFilter] = useState<'All' | 'Yes' | 'No'>('All');
  const [activeTab, setActiveTab] = useState<'repos' | 'logs'>('repos');

  // Triggering State
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Selected Repo Modal
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  // Derive unique languages
  const languages = useMemo(() => {
    const list = new Set<string>();
    initialRepos.forEach(r => {
      if (r.language) list.add(r.language);
    });
    return ['All', ...Array.from(list)];
  }, [initialRepos]);

  // Statistics
  const stats = useMemo(() => {
    const total = initialRepos.length;
    const starred = initialRepos.filter(r => r.starred).length;
    const followed = initialRepos.filter(r => r.followed).length;
    const mutuals = initialRepos.filter(r => r.follow_back).length;
    const totalGrade = initialRepos.reduce((acc, r) => acc + (r.grade || 0), 0);
    const avgGrade = total > 0 ? (totalGrade / total).toFixed(1) : '0';

    return { total, starred, followed, avgGrade, mutuals };
  }, [initialRepos]);

  // Apply filters
  const filteredRepos = useMemo(() => {
    return initialRepos.filter(repo => {
      const matchesSearch = 
        `${repo.owner}/${repo.name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.topics && repo.topics.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
      
      const matchesGrade = repo.grade >= minGrade;
      
      const matchesLang = selectedLanguage === 'All' || repo.language === selectedLanguage;
      
      const matchesFollow = 
        followedFilter === 'All' || 
        (followedFilter === 'Yes' && repo.followed) || 
        (followedFilter === 'No' && !repo.followed && !repo.unfollowed) ||
        (followedFilter === 'Unfollowed' && repo.unfollowed);

      const matchesStar = 
        starredFilter === 'All' || 
        (starredFilter === 'Yes' && repo.starred) || 
        (starredFilter === 'No' && !repo.starred);

      return matchesSearch && matchesGrade && matchesLang && matchesFollow && matchesStar;
    });
  }, [initialRepos, searchTerm, minGrade, selectedLanguage, followedFilter, starredFilter]);

  // Handle run trigger
  const handleTrigger = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    setTriggerStatus(null);

    const result = await triggerWorker();
    
    setIsTriggering(false);
    setTriggerStatus({ success: result.success, message: result.success ? result.message : result.error });

    if (result.success) {
      // Refresh page data
      router.refresh();
    }
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 9) return 'from-emerald-400 to-green-600 shadow-emerald-950/40 text-emerald-950';
    if (grade >= 7) return 'from-teal-400 to-indigo-500 shadow-teal-950/40 text-teal-950';
    if (grade >= 5) return 'from-amber-400 to-orange-500 shadow-amber-950/40 text-amber-950';
    return 'from-rose-500 to-red-600 shadow-rose-950/40 text-rose-50';
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Github className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-teal-300 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                FollowMe
              </h1>
              <p className="text-xs text-slate-400">GitHub AI-Powered Evaluator</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.refresh()}
              className="p-2 text-slate-400 hover:text-white rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-900 transition-all cursor-pointer"
              title="Refresh Dashboard Data"
            >
              <RotateCw className="h-5 w-5" />
            </button>
            <button
              onClick={handleTrigger}
              disabled={isTriggering}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 cursor-pointer shadow-lg ${
                isTriggering 
                  ? 'bg-indigo-600/40 text-slate-300 border border-indigo-700/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-400 to-indigo-600 hover:from-teal-300 hover:to-indigo-500 text-white shadow-indigo-600/20 hover:scale-[1.02]'
              }`}
            >
              {isTriggering ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  <span>Triggering...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Run Worker Job</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col space-y-8">
        
        {/* Status Toast Banner */}
        {triggerStatus && (
          <div className={`p-4 rounded-xl border flex items-center justify-between shadow-xl animate-fade-in ${
            triggerStatus.success 
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300 shadow-emerald-900/10'
              : 'bg-rose-950/40 border-rose-800 text-rose-300 shadow-rose-900/10'
          }`}>
            <div className="flex items-center space-x-3">
              {triggerStatus.success ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-rose-400" />}
              <span className="text-sm font-medium">{triggerStatus.message}</span>
            </div>
            <button 
              onClick={() => setTriggerStatus(null)}
              className="text-xs font-semibold uppercase hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-md transition hover:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Evaluated</p>
            <h3 className="text-3xl font-extrabold mt-2 text-white">{stats.total}</h3>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-md transition hover:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Repo Quality</p>
            <h3 className="text-3xl font-extrabold mt-2 bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent">
              {stats.avgGrade} <span className="text-lg text-slate-500 font-normal">/10</span>
            </h3>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-md transition hover:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Auto Starred</p>
            <h3 className="text-3xl font-extrabold mt-2 text-amber-400 flex items-center space-x-2">
              <span>{stats.starred}</span>
              <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
            </h3>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-md transition hover:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Auto Followed</p>
            <h3 className="text-3xl font-extrabold mt-2 text-teal-400 flex items-center space-x-2">
              <span>{stats.followed}</span>
              <UserPlus className="h-6 w-6 text-teal-400" />
            </h3>
          </div>
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-md transition hover:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mutuals</p>
            <h3 className="text-3xl font-extrabold mt-2 text-indigo-400 flex items-center space-x-2">
              <span>{stats.mutuals}</span>
              <CheckCircle className="h-6 w-6 text-indigo-400" />
            </h3>
          </div>
        </section>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('repos')}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'repos' 
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' 
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Github className="h-4 w-4" />
            <span>Discovered Repos ({filteredRepos.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'logs' 
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' 
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Activity Logs ({initialLogs.length})</span>
          </button>
        </div>

        {activeTab === 'repos' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Filters Sidebar */}
            <aside className="lg:col-span-1 space-y-6 bg-slate-900/30 border border-slate-800/80 p-6 rounded-2xl h-fit">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="font-bold text-sm tracking-wide text-slate-200 uppercase flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-indigo-400" />
                  <span>Filters</span>
                </span>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setMinGrade(0);
                    setSelectedLanguage('All');
                    setFollowedFilter('All');
                    setStarredFilter('All');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  Reset All
                </button>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-slate-400">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search name, topic..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
              </div>

              {/* Min Grade Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold uppercase text-slate-400 font-mono">Min Quality Grade</label>
                  <span className="text-sm font-bold text-teal-400 bg-teal-950/40 px-2 py-0.5 rounded border border-teal-900/60">{minGrade || 'Any'}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={minGrade}
                  onChange={(e) => setMinGrade(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none focus:ring-0"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-600 font-mono">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-slate-400">Language</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Starred Status */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-slate-400">Starred</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['All', 'Yes', 'No'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setStarredFilter(opt)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        starredFilter === opt
                          ? 'bg-amber-400/10 text-amber-400 border-amber-400/40 font-bold'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Followed Status */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-slate-400">Followed Owner</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['All', 'Yes', 'No', 'Unfollowed'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setFollowedFilter(opt)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        followedFilter === opt
                          ? 'bg-teal-400/10 text-teal-400 border-teal-400/40 font-bold'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Repos Grid */}
            <div className="lg:col-span-3">
              {filteredRepos.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/10 border border-slate-850 rounded-2xl flex flex-col items-center justify-center space-y-4">
                  <Github className="h-12 w-12 text-slate-600 animate-pulse" />
                  <h3 className="font-bold text-lg text-slate-300">No repositories found</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Try loosening your search terms or filters, or run the worker job to find new repos!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="group relative bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-slate-700/80 flex flex-col justify-between"
                    >
                      <div>
                        {/* Title and Grade */}
                        <div className="flex items-start justify-between space-x-4 mb-3">
                          <div className="truncate">
                            <span className="text-xs text-slate-500 font-mono block">@{repo.owner}</span>
                            <a
                              href={repo.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-lg font-bold text-slate-100 hover:text-indigo-400 transition flex items-center space-x-1.5 truncate group-hover:text-indigo-300"
                            >
                              <span>{repo.name}</span>
                              <ExternalLink className="h-3 w-3 inline opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          </div>
                          <div className={`h-12 w-12 shrink-0 rounded-xl bg-gradient-to-tr flex flex-col items-center justify-center shadow-lg font-mono font-black text-lg ${getGradeColor(repo.grade)}`}>
                            <span>{repo.grade}</span>
                            <span className="text-[8px] uppercase tracking-wider leading-none">grade</span>
                          </div>
                        </div>

                        {/* Stars and Lang */}
                        <div className="flex items-center space-x-4 text-xs font-mono text-slate-400 mb-4">
                          <span className="flex items-center space-x-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400/20 text-amber-400" />
                            <span>{repo.stars.toLocaleString()} stars</span>
                          </span>
                          {repo.language && (
                            <span className="flex items-center space-x-1">
                              <Code className="h-3.5 w-3.5 text-indigo-400" />
                              <span>{repo.language}</span>
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {repo.readme_snippet && (
                          <div className="mt-3">
                            <p className="text-sm text-slate-450 line-clamp-3 leading-relaxed">
                              {cleanSnippet(repo.readme_snippet).split('\n').filter(line => line.trim() !== '')[0] || 'No snippet description available.'}
                            </p>
                          </div>
                        )}

                        {/* Topics */}
                        {repo.topics && repo.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-4">
                            {repo.topics.slice(0, 4).map((topic) => (
                              <span
                                key={topic}
                                className="text-[10px] font-mono px-2 py-0.5 bg-slate-950/80 border border-slate-800 text-slate-400 rounded-md font-semibold"
                              >
                                #{topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action status & details button */}
                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-6">
                        <div className="flex items-center space-x-2.5">
                          {repo.starred ? (
                            <span className="inline-flex items-center space-x-1 bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                              <Star className="h-2.5 w-2.5 fill-amber-400" />
                              <span>Starred</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">Not Starred</span>
                          )}
                          {repo.followed ? (
                            <span className="inline-flex items-center space-x-1 bg-teal-400/10 border border-teal-400/20 text-teal-400 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                              <UserPlus className="h-2.5 w-2.5" />
                              <span>Followed</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">Not Followed</span>
                          )}
                        </div>

                        {repo.readme_snippet && (
                          <button
                            onClick={() => setSelectedRepo(repo)}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center space-x-1 px-2.5 py-1.5 hover:bg-slate-850 rounded-lg cursor-pointer"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Readme</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Activity Logs View */
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <h3 className="font-bold text-slate-200">Execution History & Action Logs</h3>
              <span className="text-xs text-slate-500">Showing last 50 actions</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold uppercase text-slate-400 bg-slate-950/30">
                    <th className="px-6 py-3.5">Timestamp</th>
                    <th className="px-6 py-3.5">Action</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm font-mono">
                  {initialLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No activity logged yet.
                      </td>
                    </tr>
                  ) : (
                    initialLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/30 transition">
                        <td className="px-6 py-3.5 text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${
                            log.action === 'SYSTEM' ? 'bg-slate-800 text-slate-300' :
                            log.action === 'GRADE' ? 'bg-indigo-950 text-indigo-400 border border-indigo-900/30' :
                            log.action === 'STAR' ? 'bg-amber-950 text-amber-400 border border-amber-900/30' :
                            log.action === 'FOLLOW' ? 'bg-teal-950 text-teal-400 border border-teal-900/30' :
                            'bg-slate-850 text-slate-400'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          {log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-400 font-bold">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>SUCCESS</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-rose-400 font-bold">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>FAILED</span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-slate-300 max-w-lg truncate" title={log.message}>
                          {log.message}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© 2026 FollowMe GitHub Automation Dashboard. Built with Next.js, Supabase, and NVIDIA NIM.</p>
      </footer>

      {/* README Snippet Preview Modal */}
      {selectedRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-mono">README Snippet Evaluation</span>
                <h3 className="font-bold text-lg text-slate-100 flex items-center space-x-2">
                  <span>{selectedRepo.owner}/{selectedRepo.name}</span>
                  <span className="px-2 py-0.5 bg-slate-800 text-xs font-mono text-slate-300 rounded">
                    Score: {selectedRepo.grade}/10
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedRepo(null)}
                className="text-slate-400 hover:text-white font-bold px-3 py-1.5 hover:bg-slate-800 rounded-lg cursor-pointer transition"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto font-mono text-sm text-slate-350 bg-slate-950/60 leading-relaxed whitespace-pre-wrap select-text flex-1">
              {cleanSnippet(selectedRepo.readme_snippet) || 'No README data saved.'}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <a
                href={selectedRepo.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/10 cursor-pointer"
              >
                <span>View Full Repo on GitHub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
