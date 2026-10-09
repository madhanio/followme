import type { GitHubRateLimitData, SystemHealthState } from '@/app/actions';
export type { GitHubRateLimitData, SystemHealthState };

export interface Repo {
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
  follow_skipped?: boolean;
  follow_skip_reason?: string;
  reason?: string | null;
  bio?: string | null;
  followers_count?: number | null;
  following_count?: number | null;
  account_created_at?: string | null;
  last_pushed_at?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Log {
  id: number;
  action: string;
  repo_id: number | null;
  timestamp: string;
  status: string;
  message: string;
}

export interface RunSummary {
  id: string;
  ran_at: string;
  profiles_followed: number;
  profiles_unfollowed: number;
  repos_starred: number;
  mutuals_found: number;
  profiles_skipped: number;
  profiles_evaluated: number;
  run_type: string;
}

export interface UserProfile {
  login: string;
  name: string;
  avatar_url: string;
  email: string;
}

export interface ProfileItem {
  owner: string;
  login?: string;
  avatar_url?: string | null;
  grade?: number | null;
  followed?: boolean | null;
  follow_back?: boolean | null;
  unfollowed?: boolean | null;
  language?: string | null;
  reposCount: number;
  repos: Repo[];
  languages?: string[];
  avgGrade: number;
  totalGrade?: number;
  latestGradedAt?: string;
  reason?: string | null;
  bio?: string | null;
  followers_count?: number | null;
  following_count?: number | null;
  followStatus: {
    followed: boolean;
    unfollowed: boolean;
    follow_back: boolean;
    follow_skipped: boolean;
    followed_at?: string;
    reason?: string;
  };
}
