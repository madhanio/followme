-- ==============================================================================
-- FollowMe Database Schema (Profiles-First Architecture)
-- Single project database supporting FollowMe candidate evaluation & tracking
-- ==============================================================================

-- 1. Profiles Table (Core single source of truth for all candidates)
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
    top_repos JSONB DEFAULT '[]'::jsonb,      -- strictly top 3 projects [{ name, stars, language, description, pushed_at }]
    languages JSONB DEFAULT '[]'::jsonb,      -- top languages breakdown [{ name, pct }]
    found_by TEXT DEFAULT 'GitHub topic & open-source discovery',
    whitelisted BOOLEAN DEFAULT FALSE,        -- protected from auto-unfollow
    grade NUMERIC DEFAULT 0,                  -- 1 to 10 AI evaluation score
    graded_at TIMESTAMPTZ,
    followed BOOLEAN DEFAULT FALSE,
    followed_at TIMESTAMPTZ,
    follow_back BOOLEAN DEFAULT FALSE,
    unfollowed BOOLEAN DEFAULT FALSE,
    unfollowed_at TIMESTAMPTZ,
    follow_skipped BOOLEAN DEFAULT FALSE,
    follow_skip_reason TEXT,
    reason TEXT,                              -- One-line editorial reason why followed or skipped
    ai_evaluation JSONB,                      -- Full LLM scorecard metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_profiles_owner ON profiles(owner);
CREATE INDEX IF NOT EXISTS idx_profiles_grade ON profiles(grade);
CREATE INDEX IF NOT EXISTS idx_profiles_followed ON profiles(followed);
CREATE INDEX IF NOT EXISTS idx_profiles_follow_back ON profiles(follow_back);
CREATE INDEX IF NOT EXISTS idx_profiles_unfollowed ON profiles(unfollowed);
CREATE INDEX IF NOT EXISTS idx_profiles_whitelisted ON profiles(whitelisted);
CREATE INDEX IF NOT EXISTS idx_profiles_last_pushed_at ON profiles(last_pushed_at);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

-- 2. Logs Table (Action history referencing owner directly)
CREATE TABLE IF NOT EXISTS logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action TEXT NOT NULL,                     -- 'FOLLOW', 'UNFOLLOW', 'SKIP_FOLLOW', 'GRADE', 'STAR', 'SYSTEM'
    owner TEXT,                               -- GitHub username action relates to
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL,                     -- 'SUCCESS', 'FAILED', 'ERROR', 'WARN'
    message TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_owner ON logs(owner);

-- 3. Run Summary Table (Append-only worker run statistics)
CREATE TABLE IF NOT EXISTS run_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ran_at TIMESTAMPTZ DEFAULT NOW(),
    profiles_followed INT DEFAULT 0,
    profiles_unfollowed INT DEFAULT 0,
    repos_starred INT DEFAULT 0,
    mutuals_found INT DEFAULT 0,
    profiles_skipped INT DEFAULT 0,
    profiles_evaluated INT DEFAULT 0,
    run_type TEXT DEFAULT 'evaluation'
);

-- 4. Incident Log Table (Deduplication and alert dispatch tracking)
CREATE TABLE IF NOT EXISTS incident_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_type TEXT UNIQUE NOT NULL,
    last_sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'ACTIVE',    -- 'ACTIVE', 'RESOLVED'
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_incident_log_type ON incident_log(incident_type);

-- 5. Settings Table (Single source of truth for runtime config)
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow service_role full profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow select logs" ON logs FOR SELECT USING (true);
CREATE POLICY "Allow service_role full logs" ON logs FOR ALL USING (true);
CREATE POLICY "Allow select run_summary" ON run_summary FOR SELECT USING (true);
CREATE POLICY "Allow service_role full run_summary" ON run_summary FOR ALL USING (true);

-- Protect sensitive keys in settings: anon client cannot read sensitive tokens/keys
DROP POLICY IF EXISTS "Allow select non-sensitive settings" ON settings;
CREATE POLICY "Allow select non-sensitive settings" ON settings
  FOR SELECT USING (
    lower(replace(key, '_', '')) NOT IN (
      'githubtoken', 'resendapikey', 'dashboardpassword', 'webhooksecret'
    )
  );

CREATE POLICY "Allow select incident_log" ON incident_log FOR SELECT USING (true);



