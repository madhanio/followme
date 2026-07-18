-- Create repos table
CREATE TABLE IF NOT EXISTS repos (
    id BIGINT PRIMARY KEY, -- GitHub Repo ID to avoid duplicates
    github_url TEXT NOT NULL,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    stars INTEGER NOT NULL DEFAULT 0,
    language TEXT,
    topics TEXT[] DEFAULT '{}',
    readme_snippet TEXT,
    grade INTEGER,
    graded_at TIMESTAMPTZ,
    followed BOOLEAN DEFAULT FALSE,
    starred BOOLEAN DEFAULT FALSE,
    followed_at TIMESTAMPTZ,
    follow_back BOOLEAN DEFAULT FALSE,
    unfollowed BOOLEAN DEFAULT FALSE,
    follow_skipped BOOLEAN DEFAULT FALSE,
    follow_skip_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create logs table for tracking actions
CREATE TABLE IF NOT EXISTS logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action TEXT NOT NULL, -- e.g., 'DISCOVER', 'GRADE', 'STAR', 'FOLLOW', 'SYSTEM'
    repo_id BIGINT REFERENCES repos(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED'
    message TEXT
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_repos_grade ON repos(grade);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repos(language);
CREATE INDEX IF NOT EXISTS idx_repos_followed ON repos(followed);
CREATE INDEX IF NOT EXISTS idx_repos_starred ON repos(starred);
CREATE INDEX IF NOT EXISTS idx_repos_follow_back ON repos(follow_back);
CREATE INDEX IF NOT EXISTS idx_repos_unfollowed ON repos(unfollowed);
CREATE INDEX IF NOT EXISTS idx_repos_follow_skipped ON repos(follow_skipped);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);

-- Create lightweight run_summary table
CREATE TABLE IF NOT EXISTS run_summary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ran_at timestamptz DEFAULT now(),
  profiles_followed int DEFAULT 0,
  profiles_unfollowed int DEFAULT 0,
  repos_starred int DEFAULT 0,
  mutuals_found int DEFAULT 0,
  profiles_skipped int DEFAULT 0,
  profiles_evaluated int DEFAULT 0,
  run_type text DEFAULT 'evaluation'
);

