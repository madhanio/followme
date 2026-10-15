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

-- Create incident_log table for deduplication and incident tracking
CREATE TABLE IF NOT EXISTS incident_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type text UNIQUE NOT NULL,
  last_sent_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RESOLVED'
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_incident_log_type ON incident_log(incident_type);

-- Create settings table as single source of truth for runtime config
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Create profiles table (First-class developer candidate store)
CREATE TABLE IF NOT EXISTS profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    public_repos_count INTEGER DEFAULT 0,
    account_created_at TIMESTAMPTZ,
    account_age_years NUMERIC,
    last_pushed_at TIMESTAMPTZ,
    top_repos JSONB DEFAULT '[]'::jsonb,      -- strictly top 3 projects
    languages JSONB DEFAULT '[]'::jsonb,      -- top language breakdown
    found_by TEXT DEFAULT 'GitHub topic & open-source discovery',
    whitelisted BOOLEAN DEFAULT FALSE,        -- protected from auto-unfollow
    ai_evaluation JSONB,                      -- editorial LLM scorecard & rationale
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure repos table has all enriched columns including whitelisted
ALTER TABLE repos ADD COLUMN IF NOT EXISTS whitelisted BOOLEAN DEFAULT FALSE;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS account_created_at TIMESTAMPTZ;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS last_pushed_at TIMESTAMPTZ;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS reason TEXT;

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_profiles_owner ON profiles(owner);
CREATE INDEX IF NOT EXISTS idx_profiles_whitelisted ON profiles(whitelisted);
CREATE INDEX IF NOT EXISTS idx_profiles_last_pushed_at ON profiles(last_pushed_at);
CREATE INDEX IF NOT EXISTS idx_repos_whitelisted ON repos(whitelisted);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow service_role full profiles" ON profiles FOR ALL USING (true);


