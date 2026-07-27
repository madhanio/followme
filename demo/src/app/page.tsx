'use client';

import DashboardView from './DashboardView';

const MOCK_REPOS = [
  {
    id: 101,
    github_url: 'https://github.com/alex-dev-labs/agentic-workflow-engine',
    owner: 'alex-dev-labs',
    name: 'agentic-workflow-engine',
    stars: 342,
    language: 'TypeScript',
    topics: ['agentic-ai', 'llm-orchestration', 'typescript', 'autonomous-agents'],
    readme_snippet: 'An open-source lightweight engine for building multi-agentic DAG workflows with native streaming support.',
    grade: 9.2,
    graded_at: '2026-07-27T18:30:12Z',
    followed: true,
    starred: true,
    followed_at: '2026-07-27T18:30:15Z',
    follow_back: true,
    unfollowed: false,
    follow_skipped: false
  },
  {
    id: 102,
    github_url: 'https://github.com/sarah-codecraft/react-fast-data-grid',
    owner: 'sarah-codecraft',
    name: 'react-fast-data-grid',
    stars: 189,
    language: 'TypeScript',
    topics: ['react', 'data-grid', 'canvas-rendering', 'virtualization'],
    readme_snippet: 'Ultra high-performance virtualized canvas data grid for React applications handling millions of rows.',
    grade: 8.7,
    graded_at: '2026-07-27T17:45:00Z',
    followed: true,
    starred: true,
    followed_at: '2026-07-27T17:45:02Z',
    follow_back: true,
    unfollowed: false,
    follow_skipped: false
  },
  {
    id: 103,
    github_url: 'https://github.com/vector-ai-core/rust-hnsw-vector-db',
    owner: 'vector-ai-core',
    name: 'rust-hnsw-vector-db',
    stars: 512,
    language: 'Rust',
    topics: ['rust', 'vector-database', 'hnsw', 'embeddings'],
    readme_snippet: 'Zero-dependency embedded vector similarity search engine written in pure Rust with AVX-512 acceleration.',
    grade: 9.8,
    graded_at: '2026-07-27T16:15:33Z',
    followed: true,
    starred: true,
    followed_at: '2026-07-27T16:15:35Z',
    follow_back: false,
    unfollowed: false,
    follow_skipped: false
  },
  {
    id: 104,
    github_url: 'https://github.com/quantum-hacker/pqc-kyber-go',
    owner: 'quantum-hacker',
    name: 'pqc-kyber-go',
    stars: 94,
    language: 'Go',
    topics: ['post-quantum-cryptography', 'kyber', 'go', 'security'],
    readme_snippet: 'Clean Go implementation of NIST Post-Quantum Cryptography Standardization winner CRYSTALS-Kyber.',
    grade: 8.4,
    graded_at: '2026-07-27T14:02:19Z',
    followed: true,
    starred: false,
    followed_at: '2026-07-27T14:02:21Z',
    follow_back: true,
    unfollowed: false,
    follow_skipped: false
  },
  {
    id: 105,
    github_url: 'https://github.com/mega-corp-tech/monorepo-tooling',
    owner: 'mega-corp-tech',
    name: 'monorepo-tooling',
    stars: 1240,
    language: 'JavaScript',
    topics: ['monorepo', 'tooling'],
    readme_snippet: 'Internal build system wrappers for multi-language projects.',
    grade: 4.5,
    graded_at: '2026-07-27T12:30:00Z',
    followed: false,
    starred: false,
    follow_skipped: true,
    follow_skip_reason: 'too-popular (> 500 followers)',
    unfollowed: false
  },
  {
    id: 106,
    github_url: 'https://github.com/dev-zero-99/my-first-repo',
    owner: 'dev-zero-99',
    name: 'my-first-repo',
    stars: 1,
    language: 'Python',
    topics: ['test'],
    readme_snippet: 'Hello world test repository.',
    grade: 3.0,
    graded_at: '2026-07-27T11:10:45Z',
    followed: false,
    starred: false,
    follow_skipped: true,
    follow_skip_reason: 'too-new (< 3 followers)',
    unfollowed: false
  },
  {
    id: 107,
    github_url: 'https://github.com/elena-nn-research/flash-attention-v3-cuda',
    owner: 'elena-nn-research',
    name: 'flash-attention-v3-cuda',
    stars: 420,
    language: 'C++',
    topics: ['cuda', 'flash-attention', 'deep-learning', 'pytorch-extension'],
    readme_snippet: 'Experimental CUDA kernels optimizing transformer sequence length scaling up to 128k context windows.',
    grade: 9.5,
    graded_at: '2026-07-27T09:50:11Z',
    followed: true,
    starred: true,
    followed_at: '2026-07-27T09:50:15Z',
    follow_back: true,
    unfollowed: false,
    follow_skipped: false
  },
  {
    id: 108,
    github_url: 'https://github.com/micro-service-guru/k8s-cost-allocator',
    owner: 'micro-service-guru',
    name: 'k8s-cost-allocator',
    stars: 275,
    language: 'Go',
    topics: ['kubernetes', 'cost-management', 'prometheus', 'go'],
    readme_snippet: 'Real-time granular cloud expenditure estimator mapping pod resource usage directly to billing metrics.',
    grade: 8.2,
    graded_at: '2026-07-27T08:22:54Z',
    followed: true,
    starred: true,
    followed_at: '2026-07-27T08:22:56Z',
    follow_back: false,
    unfollowed: false,
    follow_skipped: false
  }
];

const MOCK_LOGS = [
  { id: 1, action: 'FOLLOW', repo_id: 101, timestamp: '2026-07-27T18:30:15Z', status: 'SUCCESS', message: 'Followed target user: alex-dev-labs' },
  { id: 2, action: 'STAR', repo_id: 101, timestamp: '2026-07-27T18:30:14Z', status: 'SUCCESS', message: 'Starred repo: alex-dev-labs/agentic-workflow-engine' },
  { id: 3, action: 'GRADE', repo_id: 101, timestamp: '2026-07-27T18:30:12Z', status: 'SUCCESS', message: 'Graded candidate alex-dev-labs/agentic-workflow-engine. Score: 9.2/10 (NVIDIA NIM AI evaluation)' },
  { id: 4, action: 'FOLLOW', repo_id: 102, timestamp: '2026-07-27T17:45:02Z', status: 'SUCCESS', message: 'Followed target user: sarah-codecraft' },
  { id: 5, action: 'GRADE', repo_id: 102, timestamp: '2026-07-27T17:45:00Z', status: 'SUCCESS', message: 'Graded candidate sarah-codecraft/react-fast-data-grid. Score: 8.7/10' },
  { id: 6, action: 'RECIPROCAL_CHECK', repo_id: null, timestamp: '2026-07-27T16:20:00Z', status: 'SUCCESS', message: 'Sync complete: 4 mutual followers detected (alex-dev-labs, sarah-codecraft, quantum-hacker, elena-nn-research)' },
  { id: 7, action: 'FOLLOW', repo_id: 103, timestamp: '2026-07-27T16:15:35Z', status: 'SUCCESS', message: 'Followed target user: vector-ai-core' },
  { id: 8, action: 'GRADE', repo_id: 103, timestamp: '2026-07-27T16:15:33Z', status: 'SUCCESS', message: 'Graded candidate vector-ai-core/rust-hnsw-vector-db. Score: 9.8/10' },
  { id: 9, action: 'SKIP_FOLLOW', repo_id: 105, timestamp: '2026-07-27T12:30:00Z', status: 'SUCCESS', message: 'Skipped mega-corp-tech before grading — reason: too-popular (> 500 followers)' },
  { id: 10, action: 'SKIP_FOLLOW', repo_id: 106, timestamp: '2026-07-27T11:10:45Z', status: 'SUCCESS', message: 'Skipped dev-zero-99 before grading — reason: too-new (< 3 followers)' },
  { id: 11, action: 'FOLLOW', repo_id: 107, timestamp: '2026-07-27T09:50:15Z', status: 'SUCCESS', message: 'Followed target user: elena-nn-research' },
  { id: 12, action: 'GRADE', repo_id: 107, timestamp: '2026-07-27T09:50:11Z', status: 'SUCCESS', message: 'Graded candidate elena-nn-research/flash-attention-v3-cuda. Score: 9.5/10' },
  { id: 13, action: 'FOLLOW', repo_id: 108, timestamp: '2026-07-27T08:22:56Z', status: 'SUCCESS', message: 'Followed target user: micro-service-guru' },
  { id: 14, action: 'SYSTEM', repo_id: null, timestamp: '2026-07-27T08:00:00Z', status: 'SUCCESS', message: 'FollowMe Automation Job executed successfully. Pre-filtered 12 profiles, graded 6 high-potential candidates.' }
];

const MOCK_RUN_SUMMARY = [
  { id: 'rs-1', ran_at: '2026-07-27T18:30:00Z', profiles_followed: 6, profiles_unfollowed: 2, repos_starred: 5, mutuals_found: 4, profiles_skipped: 12, profiles_evaluated: 18, run_type: 'automation' },
  { id: 'rs-2', ran_at: '2026-07-26T18:30:00Z', profiles_followed: 7, profiles_unfollowed: 1, repos_starred: 6, mutuals_found: 5, profiles_skipped: 14, profiles_evaluated: 21, run_type: 'automation' },
  { id: 'rs-3', ran_at: '2026-07-25T18:30:00Z', profiles_followed: 5, profiles_unfollowed: 3, repos_starred: 4, mutuals_found: 3, profiles_skipped: 10, profiles_evaluated: 15, run_type: 'automation' },
  { id: 'rs-4', ran_at: '2026-07-24T18:30:00Z', profiles_followed: 8, profiles_unfollowed: 2, repos_starred: 7, mutuals_found: 6, profiles_skipped: 16, profiles_evaluated: 24, run_type: 'automation' }
];

export default function DemoPage() {
  return (
    <DashboardView 
      initialRepos={MOCK_REPOS} 
      initialLogs={MOCK_LOGS} 
      initialRunSummary={MOCK_RUN_SUMMARY}
    />
  );
}
