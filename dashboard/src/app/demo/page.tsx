'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  Code,
  ShieldAlert,
  ArrowUpDown,
  CornerDownRight,
  TrendingUp,
  UserMinus,
  AlertTriangle,
  Trash2,
  Settings,
  HelpCircle,
  Layers,
  Activity,
  ChevronRight,
  UserCheck,
  Zap,
  Info
} from 'lucide-react';

// Theme-specific fonts loaded dynamically
const FontLoader = () => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=Inter:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
    
    /* Apply base typography classes */
    .font-geist {
      font-family: 'Geist', sans-serif;
    }
    .font-geist-mono {
      font-family: 'Geist Mono', monospace;
    }
    .font-inter {
      font-family: 'Inter', sans-serif;
    }
    .font-jakarta {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .font-jetbrains {
      font-family: 'JetBrains Mono', monospace;
    }
    
    /* Masonry grid system */
    .masonry-grid {
      column-count: 1;
      column-gap: 1.5rem;
    }
    @media (min-width: 768px) {
      .masonry-grid {
        column-count: 2;
      }
    }
    @media (min-width: 1200px) {
      .masonry-grid {
        column-count: 3;
      }
    }
    
    .masonry-item {
      break-inside: avoid;
      margin-bottom: 1.5rem;
    }

    /* Custom high-key ambient shadow */
    .aura-shadow {
      box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.04);
    }
    
    .aura-shadow-hover:hover {
      box-shadow: 0px 8px 30px rgba(0, 0, 0, 0.08);
    }
  `}</style>
);

interface MockRepo {
  id: number;
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
  follow_back?: boolean;
  unfollowed?: boolean;
  follow_skipped?: boolean;
  follow_skip_reason?: string;
  avatar_url?: string;
}

interface MockLog {
  id: number;
  action: string;
  timestamp: string;
  status: string;
  message: string;
}

const initialMockRepos: MockRepo[] = [
  {
    id: 1,
    owner: "huggingface",
    name: "transformers",
    stars: 124000,
    language: "Python",
    topics: ["deep-learning", "pytorch", "nlp", "transformers", "artificial-intelligence"],
    readme_snippet: "State-of-the-art Machine Learning for PyTorch, TensorFlow, and JAX. Transformers provides APIs and tools to easily download and train state-of-the-art pretrained models.",
    grade: 98,
    graded_at: "2026-07-12T12:45:00Z",
    followed: true,
    starred: true,
    follow_back: true,
    avatar_url: "https://github.com/huggingface.png"
  },
  {
    id: 2,
    owner: "meta-llama",
    name: "llama3",
    stars: 38500,
    language: "Python",
    topics: ["llama", "large-language-models", "ai", "generative-ai", "machine-learning"],
    readme_snippet: "This repository contains the model definitions, inference code, and evaluation tools for Llama 3, the next generation of our state-of-the-art open-source LLM.",
    grade: 96,
    graded_at: "2026-07-12T11:30:00Z",
    followed: true,
    starred: false,
    follow_back: false,
    avatar_url: "https://github.com/meta-llama.png"
  },
  {
    id: 3,
    owner: "antigravity-labs",
    name: "aura-core",
    stars: 1200,
    language: "TypeScript",
    topics: ["design-tokens", "visual-hierarchy", "masonry-layouts", "web-components"],
    readme_snippet: "The foundational core libraries and CSS architecture for the Aura Logic design system. Built with performance and fluid layouts in mind.",
    grade: 91,
    graded_at: "2026-07-12T10:15:00Z",
    followed: true,
    starred: true,
    follow_back: true,
    avatar_url: "https://github.com/github.png"
  },
  {
    id: 4,
    owner: "supabase",
    name: "supabase",
    stars: 68400,
    language: "TypeScript",
    topics: ["postgresql", "realtime", "auth", "database", "serverless", "storage"],
    readme_snippet: "The open source Firebase alternative. Supabase is an open source Firebase alternative. We are building the features of Firebase using enterprise-grade open source tools.",
    grade: 94,
    graded_at: "2026-07-12T09:00:00Z",
    followed: false,
    starred: false,
    follow_skipped: true,
    follow_skip_reason: "User already followed through corporate account sync rules.",
    avatar_url: "https://github.com/supabase.png"
  },
  {
    id: 5,
    owner: "microsoft",
    name: "autogen",
    stars: 29500,
    language: "Python",
    topics: ["multi-agent-systems", "ai-agents", "llm-applications", "orchestration"],
    readme_snippet: "A programming framework for agentic AI. AutoGen enables next-gen LLM applications with multi-agent conversations. Jointly developed with Penn State and UChicago.",
    grade: 95,
    graded_at: "2026-07-12T08:12:00Z",
    followed: true,
    starred: false,
    follow_back: true,
    avatar_url: "https://github.com/microsoft.png"
  },
  {
    id: 6,
    owner: "lucide-icons",
    name: "lucide",
    stars: 11200,
    language: "JavaScript",
    topics: ["icons", "svg-icons", "vector-graphics", "design-system"],
    readme_snippet: "Beautiful & consistent icon toolkit made by the community. Lucide is a fork of Feather Icons. We maintain and expand the set of icons regularly.",
    grade: 89,
    graded_at: "2026-07-12T07:22:00Z",
    followed: false,
    starred: false,
    unfollowed: true,
    avatar_url: "https://github.com/lucide-icons.png"
  }
];

const initialMockLogs: MockLog[] = [
  { id: 1, action: "WORKER_RUN", timestamp: "2026-07-12T12:45:10Z", status: "SUCCESS", message: "Successfully triggered Github AI Automation worker." },
  { id: 2, action: "GRADE_REPO", timestamp: "2026-07-12T12:45:00Z", status: "SUCCESS", message: "Graded huggingface/transformers. Score: 98/100. High alignment with trending topics." },
  { id: 3, action: "STAR_REPO", timestamp: "2026-07-12T12:45:05Z", status: "SUCCESS", message: "Starred repository huggingface/transformers based on high grade." },
  { id: 4, action: "FOLLOW_USER", timestamp: "2026-07-12T12:45:07Z", status: "SUCCESS", message: "Followed developer huggingface. Mutual connection established." },
  { id: 5, action: "GRADE_REPO", timestamp: "2026-07-12T11:30:00Z", status: "SUCCESS", message: "Graded meta-llama/llama3. Score: 96/100. Excellent code density and community presence." },
  { id: 6, action: "FOLLOW_USER", timestamp: "2026-07-12T11:30:04Z", status: "SUCCESS", message: "Followed developer meta-llama. Waiting for follow back." },
  { id: 7, action: "SYNC_FOLLOWING", timestamp: "2026-07-12T10:00:00Z", status: "SUCCESS", message: "Syncing mutual following database lists with remote API. Checked 45 relationships." }
];

export default function DemoPage() {
  const [repos, setRepos] = useState<MockRepo[]>(initialMockRepos);
  const [logs, setLogs] = useState<MockLog[]>(initialMockLogs);
  const [activeTab, setActiveTab] = useState<'overview' | 'pins' | 'logs' | 'raw-json'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mutual' | 'followed' | 'skipped' | 'starred'>('all');
  const [selectedRepoJson, setSelectedRepoJson] = useState<MockRepo | null>(initialMockRepos[0]);
  const [isWorkerRunning, setIsWorkerRunning] = useState(false);

  // Stats calculation
  const stats = useMemo(() => {
    const total = repos.length;
    const starred = repos.filter(r => r.starred).length;
    const followed = repos.filter(r => r.followed && !r.follow_back).length;
    const mutuals = repos.filter(r => r.follow_back).length;
    const skipped = repos.filter(r => r.follow_skipped).length;
    const totalGrade = repos.reduce((acc, r) => acc + r.grade, 0);
    const avgGrade = total > 0 ? (totalGrade / total).toFixed(1) : "0";

    return { total, starred, followed, mutuals, skipped, avgGrade };
  }, [repos]);

  const filteredRepos = useMemo(() => {
    return repos.filter(repo => {
      const matchText = `${repo.owner}/${repo.name} ${repo.language}`.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchText) return false;
      if (filterType === 'mutual') return repo.follow_back;
      if (filterType === 'followed') return repo.followed && !repo.follow_back;
      if (filterType === 'skipped') return repo.follow_skipped;
      if (filterType === 'starred') return repo.starred;
      return true;
    });
  }, [repos, searchTerm, filterType]);

  const handleRunWorker = () => {
    if (isWorkerRunning) return;
    setIsWorkerRunning(true);
    
    // Simulate worker logs stream
    const newLog: MockLog = {
      id: Date.now(),
      action: "WORKER_TRIGGER",
      timestamp: new Date().toISOString(),
      status: "IN_PROGRESS",
      message: "Initiating live trends scanning on GitHub search indexes..."
    };
    
    setLogs(prev => [newLog, ...prev]);

    setTimeout(() => {
      const finishLog: MockLog = {
        id: Date.now() + 1,
        action: "WORKER_FINISH",
        timestamp: new Date().toISOString(),
        status: "SUCCESS",
        message: "Scanned 12 repositories. Added 1 candidate, updated 0 existing logs."
      };
      setLogs(prev => [finishLog, ...prev]);
      setIsWorkerRunning(false);
    }, 2000);
  };

  const handleToggleStar = (id: number) => {
    setRepos(prev => prev.map(r => r.id === id ? { ...r, starred: !r.starred } : r));
  };

  const handleToggleFollow = (id: number) => {
    setRepos(prev => prev.map(r => {
      if (r.id === id) {
        const isFollowed = !r.followed;
        return { 
          ...r, 
          followed: isFollowed,
          // If follow is cancelled, follow_back is also false
          follow_back: isFollowed ? r.follow_back : false
        };
      }
      return r;
    }));
  };

  const handleDeleteRepo = (id: number) => {
    setRepos(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c] flex flex-col font-inter antialiased">
      <FontLoader />
      
      {/* Container Wrapper */}
      <div className="flex flex-1 flex-col md:flex-row">
        
        {/* SIDE NAVIGATION (Geist UI navigation, headers, and primary labels) */}
        <aside className="w-full md:w-64 bg-white border-r border-[#dadada] flex flex-col justify-between py-6 px-4 shrink-0">
          <div className="space-y-7">
            {/* Title / Brand */}
            <div className="flex items-center space-x-3 px-2">
              <div className="h-9 w-9 rounded-xl bg-[#e60023] flex items-center justify-center text-white font-bold text-lg font-jakarta">
                A
              </div>
              <div>
                <h1 className="text-lg font-bold font-geist tracking-tight leading-none text-[#1a1c1c]">Antigravity</h1>
                <span className="text-[10px] uppercase font-geist-mono font-semibold tracking-wider text-slate-400 mt-1 block">Aura Logic Spec</span>
              </div>
            </div>

            {/* Menu Links */}
            <nav className="space-y-1">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-full text-sm font-semibold font-geist transition-all ${activeTab === 'overview' ? 'bg-[#f3f3f3] text-[#1a1c1c]' : 'text-[#5e3f3c] hover:bg-[#f9f9f9] hover:text-[#1a1c1c]'}`}
              >
                <div className="flex items-center space-x-3">
                  <Layers className="h-4 w-4" />
                  <span>Overview</span>
                </div>
                <ChevronRight className="h-3 w-3 opacity-60" />
              </button>

              <button 
                onClick={() => setActiveTab('pins')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-full text-sm font-semibold font-geist transition-all ${activeTab === 'pins' ? 'bg-[#f3f3f3] text-[#1a1c1c]' : 'text-[#5e3f3c] hover:bg-[#f9f9f9] hover:text-[#1a1c1c]'}`}
              >
                <div className="flex items-center space-x-3">
                  <Star className="h-4 w-4" />
                  <span>Repository Pins</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#ffdad7] text-[#e60023] font-geist-mono text-[10px] font-bold">
                  {filteredRepos.length}
                </span>
              </button>

              <button 
                onClick={() => setActiveTab('logs')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-full text-sm font-semibold font-geist transition-all ${activeTab === 'logs' ? 'bg-[#f3f3f3] text-[#1a1c1c]' : 'text-[#5e3f3c] hover:bg-[#f9f9f9] hover:text-[#1a1c1c]'}`}
              >
                <div className="flex items-center space-x-3">
                  <Terminal className="h-4 w-4" />
                  <span>Activity Logs</span>
                </div>
                <ChevronRight className="h-3 w-3 opacity-60" />
              </button>

              <button 
                onClick={() => setActiveTab('raw-json')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-full text-sm font-semibold font-geist transition-all ${activeTab === 'raw-json' ? 'bg-[#f3f3f3] text-[#1a1c1c]' : 'text-[#5e3f3c] hover:bg-[#f9f9f9] hover:text-[#1a1c1c]'}`}
              >
                <div className="flex items-center space-x-3">
                  <Code className="h-4 w-4" />
                  <span>Raw JSON Data</span>
                </div>
                <ChevronRight className="h-3 w-3 opacity-60" />
              </button>
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="space-y-4 pt-6 border-t border-[#dadada]">
            <div className="bg-[#f3f3f3] rounded-xl p-3 text-[11px] font-inter text-[#5e3f3c] leading-relaxed relative overflow-hidden">
              <div className="font-semibold text-[#1a1c1c] flex items-center space-x-1.5 mb-1">
                <Info className="h-3.5 w-3.5 text-[#e60023]" />
                <span>Demo Environment</span>
              </div>
              This shows visual hierarchy, custom grids, and color tokens matching the Aura design system.
            </div>

            <div className="flex items-center justify-between px-2 text-xs text-[#5e3f3c] font-geist">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-50 animate-pulse"></span>
                Worker Ready
              </span>
              <span className="text-[10px] font-geist-mono">V1.3.0</span>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE CONTENT */}
        <main className="flex-1 flex flex-col min-w-0">
          
          {/* TOP APP BAR */}
          <header className="h-16 bg-white border-b border-[#dadada] flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center space-x-4 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search repository tags, owners, languages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#f3f3f3] border-none rounded-full py-2 pl-10 pr-4 text-xs text-[#1a1c1c] placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-[#e60023] transition-all font-inter"
                />
              </div>
            </div>

            {/* Quick Actions (Demonstrating button hierarchy) */}
            <div className="flex items-center space-x-2">
              
              {/* Primary Button: Solid Accent (Vibrant brand color, pills) */}
              <button 
                onClick={handleRunWorker}
                disabled={isWorkerRunning}
                className="min-h-[36px] px-5 flex items-center space-x-2 bg-[#e60023] hover:bg-[#c0001b] disabled:bg-slate-300 text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm active:scale-95 animate-none"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>{isWorkerRunning ? "Running..." : "Run Task"}</span>
              </button>

              {/* Secondary Button: Outline (Crisp 1px border) */}
              <button 
                onClick={() => { setFilterType('all'); setSearchTerm(''); }}
                className="min-h-[36px] px-4 flex items-center space-x-2 bg-transparent border border-[#dadada] hover:bg-[#f3f3f3] text-[#1a1c1c] text-xs font-bold rounded-full transition-all cursor-pointer"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>

              {/* Utility Button: Icon Square (Perfect square, single SVG icon) */}
              <button 
                title="System Settings"
                className="h-9 w-9 flex items-center justify-center bg-transparent border border-[#dadada] hover:bg-[#f3f3f3] text-[#1a1c1c] rounded-lg transition-all cursor-pointer"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* MAIN PAGE BODY */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            
            {/* TAB-STYLE VIEW DECORATOR */}
            <div className="flex justify-between items-center pb-4 border-b border-[#dadada]">
              <div>
                <h2 className="text-xl font-bold font-jakarta text-[#1a1c1c] leading-tight">
                  {activeTab === 'overview' && "Dashboard Overview"}
                  {activeTab === 'pins' && "Repository Pins Grid"}
                  {activeTab === 'logs' && "System Log Streams"}
                  {activeTab === 'raw-json' && "JSON Representation Grid"}
                </h2>
                <p className="text-xs text-[#5e3f3c] mt-1 font-inter">
                  {activeTab === 'overview' && "System execution metrics, grade ratios, and mutual discovery status tracker."}
                  {activeTab === 'pins' && "Curated repositories scanned and graded by AI. Rendered in Pinterest-style layout."}
                  {activeTab === 'logs' && "Real-time action pipeline history and detailed worker evaluations."}
                  {activeTab === 'raw-json' && "Direct representation schemas of loaded models for diagnostic evaluations."}
                </p>
              </div>

              {/* Secondary view tabs inside page body */}
              <div className="flex space-x-1.5 bg-[#eeeeee] p-1 rounded-full text-xs font-medium font-geist">
                {(['overview', 'pins', 'logs', 'raw-json'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-full capitalize transition-all cursor-pointer ${activeTab === tab ? 'bg-white text-[#1a1c1c] font-semibold aura-shadow' : 'text-[#5e3f3c] hover:text-[#1a1c1c]'}`}
                  >
                    {tab.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Metric Summary Cards (Jakarta Sans for title, Inter for metrics) */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5">
                  {[
                    { title: "Total Evaluated", value: stats.total, color: "text-[#1a1c1c]", bg: "bg-white" },
                    { title: "Starred", value: stats.starred, color: "text-amber-500", bg: "bg-white" },
                    { title: "Followed", value: stats.followed, color: "text-[#0058bb]", bg: "bg-white" },
                    { title: "Mutual Connections", value: stats.mutuals, color: "text-emerald-500", bg: "bg-white" },
                    { title: "Skipped / Ignored", value: stats.skipped, color: "text-orange-500", bg: "bg-white" },
                    { title: "Avg AI Grade", value: `${stats.avgGrade}/100`, color: "text-[#e60023]", bg: "bg-white" },
                  ].map((card, i) => (
                    <div key={i} className={`${card.bg} rounded-xl p-5 border border-[#dadada] aura-shadow flex flex-col justify-between h-[120px] transition-transform duration-200 hover:scale-[1.02]`}>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#5e3f3c] font-jakarta leading-none">{card.title}</span>
                      <span className={`text-3xl font-extrabold font-inter ${card.color} tracking-tight mt-auto`}>{card.value}</span>
                    </div>
                  ))}
                </div>

                {/* Subsections */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Quick Actions & Specs demo */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Controls Redesign Demonstration Card */}
                    <div className="bg-white border border-[#dadada] rounded-xl p-6 aura-shadow space-y-5">
                      <h3 className="text-sm font-bold font-jakarta text-[#1a1c1c]">Aura Buttons Pattern Demo</h3>
                      
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-[#5e3f3c]">Primary Accent Button (Solid Pill)</label>
                          <button className="w-full min-h-[38px] flex items-center justify-center bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition-all cursor-pointer">
                            Primary Action
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-[#5e3f3c]">Secondary Outline Button (1px border)</label>
                          <button className="w-full min-h-[38px] flex items-center justify-center bg-transparent border border-[#dadada] hover:bg-[#f3f3f3] text-[#1a1c1c] text-xs font-bold rounded-full transition-all cursor-pointer">
                            Secondary Option
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-[#5e3f3c]">Tertiary Text Button (Text Only)</label>
                          <div className="flex justify-center">
                            <button className="min-h-[32px] px-4 bg-transparent hover:bg-slate-100 text-[#767676] hover:text-[#1a1c1c] text-xs font-semibold rounded-full transition-all cursor-pointer">
                              Tertiary Action
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-[#5e3f3c] block">Utility Button (Square Icon Grid)</label>
                          <div className="flex space-x-2">
                            {['Sync', 'Settings', 'Clear', 'Delete'].map((action, i) => (
                              <button key={i} title={action} className="h-9 w-9 flex items-center justify-center bg-white border border-[#dadada] hover:bg-[#f3f3f3] text-[#5e3f3c] hover:text-[#1a1c1c] rounded-lg transition-all cursor-pointer">
                                {i === 0 && <RotateCw className="h-4 w-4" />}
                                {i === 1 && <Settings className="h-4 w-4" />}
                                {i === 2 && <HelpCircle className="h-4 w-4" />}
                                {i === 3 && <Trash2 className="h-4 w-4 text-rose-500" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Developer Network Status */}
                    <div className="bg-white border border-[#dadada] rounded-xl p-6 aura-shadow space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold font-jakarta text-[#1a1c1c]">Network Overview</h3>
                        <span className="px-2 py-0.5 rounded-full bg-[#fefeec] text-amber-600 border border-amber-200 font-geist-mono text-[9px] font-bold">Sync Pending</span>
                      </div>
                      <div className="space-y-3 font-inter text-xs text-[#5e3f3c]">
                        <div className="flex justify-between border-b border-[#eeeeee] pb-2">
                          <span>Mutual Connection Rate</span>
                          <span className="font-bold text-[#1a1c1c]">66.7%</span>
                        </div>
                        <div className="flex justify-between border-b border-[#eeeeee] pb-2">
                          <span>Pending Callback Checks</span>
                          <span className="font-bold text-[#1a1c1c]">2 Accounts</span>
                        </div>
                        <div className="flex justify-between pb-1">
                          <span>Average Scanned Rank</span>
                          <span className="font-bold text-[#1a1c1c]">Top 5% Global</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visual representation of Masonry elements */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold font-jakarta text-[#1a1c1c]">Top Rated Repositories</h3>
                      
                      <div className="flex space-x-1">
                        {(['all', 'mutual', 'followed', 'skipped'] as const).map(tab => (
                          <button
                            key={tab}
                            onClick={() => setFilterType(tab)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-tight font-geist border transition-all cursor-pointer ${filterType === tab ? 'bg-[#e60023] text-white border-transparent' : 'bg-white text-[#5e3f3c] border-[#dadada] hover:bg-[#f3f3f3]'}`}
                          >
                            {tab === 'all' ? 'All Pins' : `${tab.toUpperCase()}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Miniature Grid (showing 2-column mockup) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredRepos.slice(0, 4).map(repo => (
                        <div 
                          key={repo.id} 
                          className="bg-white rounded-xl p-5 border border-[#dadada] aura-shadow aura-shadow-hover transition-all duration-200 hover:scale-[1.01] flex flex-col justify-between space-y-4"
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3 min-w-0">
                              <img 
                                src={repo.avatar_url || `https://github.com/${repo.owner}.png`} 
                                alt={repo.owner} 
                                className="h-8 w-8 rounded-full border border-[#dadada] object-cover"
                              />
                              <div className="truncate">
                                <h4 className="text-xs font-bold text-[#1a1c1c] font-geist truncate">@{repo.owner}</h4>
                                <h3 className="text-sm font-extrabold text-[#1a1c1c] font-jakarta truncate">{repo.name}</h3>
                              </div>
                            </div>
                            
                            {/* Grade Badge */}
                            <span className="px-2.5 py-0.5 rounded-full bg-[#fff7f6] text-[#e60023] border border-[#e8bcb8] font-geist-mono text-[10px] font-extrabold">
                              {repo.grade}%
                            </span>
                          </div>

                          {/* Card Content Snippet (Inter) */}
                          <p className="text-xs text-[#5e3f3c] font-inter line-clamp-3 leading-relaxed">
                            {repo.readme_snippet}
                          </p>

                          {/* Language & Metadata row */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#eeeeee]">
                            <span className="px-2 py-0.5 rounded-full bg-[#f3f3f3] text-[#1a1c1c] font-geist-mono text-[9px] font-semibold">
                              {repo.language}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 font-inter">
                              <Star className="h-3 w-3 fill-current" />
                              {(repo.stars / 1000).toFixed(1)}k
                            </span>
                            
                            {/* Connection pill state */}
                            {repo.follow_back ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-geist-mono text-[9px] font-bold ml-auto">
                                Mutual
                              </span>
                            ) : repo.followed ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0058bb] border border-blue-200 font-geist-mono text-[9px] font-bold ml-auto">
                                Followed
                              </span>
                            ) : repo.follow_skipped ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 font-geist-mono text-[9px] font-semibold ml-auto" title={repo.follow_skip_reason}>
                                Skipped
                              </span>
                            ) : null}
                          </div>

                          {/* Card Interactions (showing primary vs secondary inside card) */}
                          <div className="flex gap-2 pt-1.5">
                            {repo.followed ? (
                              <button 
                                onClick={() => handleToggleFollow(repo.id)}
                                className="flex-1 min-h-[32px] flex items-center justify-center bg-transparent border border-rose-200 hover:bg-rose-50 text-rose-600 text-[10px] font-bold rounded-full transition-all cursor-pointer"
                              >
                                Unfollow
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleToggleFollow(repo.id)}
                                className="flex-1 min-h-[32px] flex items-center justify-center bg-[#e60023] hover:bg-[#c0001b] text-white text-[10px] font-bold rounded-full transition-all cursor-pointer"
                              >
                                Follow
                              </button>
                            )}
                            
                            <button 
                              onClick={() => handleToggleStar(repo.id)}
                              className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${repo.starred ? 'bg-amber-50 border-amber-300 text-amber-500' : 'bg-white border-[#dadada] text-slate-400 hover:bg-[#f3f3f3]'}`}
                            >
                              <Star className={`h-3.5 w-3.5 ${repo.starred ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* REPOSITORY PINS TAB */}
            {activeTab === 'pins' && (
              <div className="space-y-6">
                {/* Search / Filter Context bar */}
                <div className="bg-white border border-[#dadada] rounded-xl p-4 aura-shadow flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-[#5e3f3c]" />
                    <span className="text-xs font-semibold text-[#1a1c1c] font-geist">Filter Pins:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'all', label: 'All Repos' },
                        { key: 'mutual', label: 'Mutual Follows' },
                        { key: 'followed', label: 'Followed Accounts' },
                        { key: 'skipped', label: 'Skipped Tasks' },
                        { key: 'starred', label: 'Starred' },
                      ].map(btn => (
                        <button
                          key={btn.key}
                          onClick={() => setFilterType(btn.key as any)}
                          className={`px-3 py-1 rounded-full text-xs font-bold font-geist border transition-all cursor-pointer ${filterType === btn.key ? 'bg-[#e60023] text-white border-transparent' : 'bg-transparent text-[#5e3f3c] border-[#dadada] hover:bg-[#f3f3f3]'}`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <span className="text-xs text-[#5e3f3c] font-inter">
                    Showing <strong className="text-[#1a1c1c]">{filteredRepos.length}</strong> repository records
                  </span>
                </div>

                {/* Masonry-Style Grid Container */}
                {filteredRepos.length > 0 ? (
                  <div className="masonry-grid">
                    {filteredRepos.map(repo => (
                      <div 
                        key={repo.id}
                        className="masonry-item bg-white rounded-xl p-6 border border-[#dadada] aura-shadow aura-shadow-hover transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between space-y-4"
                      >
                        {/* Header Details */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3.5 min-w-0">
                            <img 
                              src={repo.avatar_url} 
                              alt={repo.owner} 
                              className="h-9 w-9 rounded-full border border-[#dadada] object-cover"
                            />
                            <div className="truncate">
                              <span className="text-[11px] font-bold text-[#5e3f3c] font-geist block leading-none mb-1">@{repo.owner}</span>
                              <h3 className="text-base font-extrabold text-[#1a1c1c] font-jakarta leading-tight truncate">{repo.name}</h3>
                            </div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#fff7f6] text-[#e60023] border border-[#e8bcb8] font-geist-mono text-[10px] font-extrabold">
                            {repo.grade}%
                          </span>
                        </div>

                        {/* Readme Snippet */}
                        <p className="text-xs font-inter text-[#5e3f3c] leading-relaxed">
                          {repo.readme_snippet}
                        </p>

                        {/* Tags / Chips (Pills) */}
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {repo.topics.slice(0, 3).map((topic, i) => (
                            <span key={i} className="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-inter text-[9px] font-semibold transition-colors cursor-pointer">
                              #{topic}
                            </span>
                          ))}
                        </div>

                        {/* Language / Sparkline / Count details */}
                        <div className="flex items-center justify-between pt-3 border-t border-[#eeeeee] text-xs">
                          <div className="flex items-center space-x-3 font-geist-mono text-[10px] text-[#5e3f3c]">
                            <span className="flex items-center gap-1">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#e60023]" />
                              {repo.language}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-amber-500">
                              <Star className="h-3 w-3 fill-current" />
                              {(repo.stars / 1000).toFixed(1)}k stars
                            </span>
                          </div>

                          {/* Quick indicators */}
                          <div className="flex gap-1.5">
                            {repo.follow_back && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-geist-mono text-[8px] font-bold">Mutual</span>
                            )}
                            {repo.starred && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-geist-mono text-[8px] font-bold">Starred</span>
                            )}
                          </div>
                        </div>

                        {/* Hover elements / Primary CTA Controls */}
                        <div className="flex items-center gap-2 pt-2">
                          
                          {/* Primary CTA (Solid White/Accent Button based on status) */}
                          {repo.followed ? (
                            <button 
                              onClick={() => handleToggleFollow(repo.id)}
                              className="flex-1 min-h-[34px] flex items-center justify-center bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-full transition-all cursor-pointer"
                            >
                              Unfollow Profile
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleToggleFollow(repo.id)}
                              className="flex-1 min-h-[34px] flex items-center justify-center bg-[#e60023] hover:bg-[#c0001b] text-white text-xs font-bold rounded-full transition-all cursor-pointer"
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                              Follow Developer
                            </button>
                          )}

                          {/* Utility square icon button */}
                          <button 
                            onClick={() => handleToggleStar(repo.id)}
                            className={`h-9 w-9 flex items-center justify-center border rounded-lg transition-all cursor-pointer ${repo.starred ? 'bg-amber-50 border-amber-300 text-amber-500' : 'bg-transparent border-[#dadada] text-[#5e3f3c] hover:bg-[#f3f3f3]'}`}
                          >
                            <Star className={`h-4 w-4 ${repo.starred ? 'fill-current' : ''}`} />
                          </button>

                          <button 
                            onClick={() => handleDeleteRepo(repo.id)}
                            title="Remove Repository record"
                            className="h-9 w-9 flex items-center justify-center bg-transparent border border-[#dadada] hover:bg-rose-50 text-rose-500 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Skipped Details warning inline */}
                        {repo.follow_skipped && (
                          <div className="bg-[#fefeec] border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 text-[10px] text-amber-700 leading-relaxed font-geist-mono">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                            <span>Skipped: {repo.follow_skip_reason}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-[#dadada] rounded-xl p-12 text-center aura-shadow space-y-3">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                    <h3 className="text-base font-bold font-jakarta text-[#1a1c1c]">No Pin Records Found</h3>
                    <p className="text-xs text-[#5e3f3c] font-inter max-w-sm mx-auto">
                      Adjust your query variables or run the automation worker logs to pull down new trending indicators.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ACTIVITY LOGS TAB (Activity logs, terminal outputs, and automated scripts - Geist Mono) */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1a1c1c] font-geist">Live Process Execution Stream:</span>
                  <button 
                    onClick={handleRunWorker} 
                    disabled={isWorkerRunning}
                    className="min-h-[30px] px-3.5 bg-[#f3f3f3] hover:bg-[#e2e2e2] text-[#1a1c1c] border border-[#dadada] text-[10px] font-bold rounded-full transition-all cursor-pointer"
                  >
                    Simulate Process Run
                  </button>
                </div>

                {/* Mock Terminal Workspace */}
                <div className="bg-[#1e1e24] text-[#d4d4d8] rounded-xl border border-slate-700 overflow-hidden aura-shadow">
                  {/* Top bar */}
                  <div className="bg-[#121215] px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-geist-mono text-slate-500 ml-4">ssh: client@aura-worker-agent</span>
                    </div>
                    <span className="text-[9px] font-geist-mono uppercase font-bold tracking-widest text-[#e60023]">Active Shell</span>
                  </div>

                  {/* Terminal Logs Stream */}
                  <div className="p-5 space-y-2.5 max-h-[450px] overflow-y-auto font-geist-mono text-xs leading-relaxed">
                    {logs.map((log, i) => (
                      <div key={log.id} className="flex items-start space-x-2 border-l-2 border-slate-800 pl-3">
                        <span className="text-[10px] text-slate-500 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className="text-slate-400 font-bold shrink-0">{log.action}:</span>
                        <div className="flex-1">
                          <span className={`${log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'} font-semibold mr-1.5`}>
                            {log.status}
                          </span>
                          <span className="text-[#dadada]">{log.message}</span>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex items-center space-x-2 text-slate-500 pt-1 select-none">
                      <span>$</span>
                      <span className="animate-pulse h-3.5 w-1.5 bg-[#e60023]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RAW JSON VIEW TAB (Raw JSON grids - JetBrains Mono) */}
            {activeTab === 'raw-json' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left side list */}
                <div className="lg:col-span-4 bg-white border border-[#dadada] rounded-xl p-5 aura-shadow space-y-4">
                  <h3 className="text-sm font-bold font-jakarta text-[#1a1c1c]">Data Schema Index</h3>
                  <div className="space-y-1">
                    {repos.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRepoJson(r)}
                        className={`w-full flex items-center justify-between text-left p-2.5 rounded-lg text-xs font-geist-mono transition-all border ${selectedRepoJson?.id === r.id ? 'bg-[#fff7f6] text-[#e60023] border-[#e8bcb8] font-bold' : 'bg-transparent text-[#5e3f3c] border-transparent hover:bg-slate-50'}`}
                      >
                        <span className="truncate">{r.owner}/{r.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right side JSON viewer */}
                <div className="lg:col-span-8 bg-white border border-[#dadada] rounded-xl p-6 aura-shadow space-y-4 flex flex-col justify-between min-h-[400px]">
                  <div className="flex items-center justify-between pb-3 border-b border-[#eeeeee]">
                    <div className="flex items-center space-x-2">
                      <Code className="h-4 w-4 text-[#e60023]" />
                      <h3 className="text-sm font-bold font-jakarta text-[#1a1c1c]">
                        JSON Object representation
                      </h3>
                    </div>
                    <span className="text-[10px] font-geist-mono text-[#5e3f3c]">schema: github.repository.v1</span>
                  </div>

                  {/* JetBrains Mono Container */}
                  <div className="flex-1 bg-slate-50 border border-[#dadada] rounded-lg p-5 overflow-auto max-h-[380px] font-jetbrains text-xs text-slate-800 leading-relaxed">
                    <pre>{JSON.stringify(selectedRepoJson, null, 2)}</pre>
                  </div>

                  {/* Foot actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedRepoJson, null, 2));
                        alert("Copied database schema payload!");
                      }}
                      className="min-h-[32px] px-4 bg-transparent border border-[#dadada] hover:bg-[#f3f3f3] text-[#1a1c1c] text-xs font-bold rounded-full transition-all cursor-pointer"
                    >
                      Copy Payload
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
