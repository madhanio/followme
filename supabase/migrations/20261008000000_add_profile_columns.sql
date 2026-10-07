-- Additive only: all columns nullable, no existing column touched
ALTER TABLE repos
  ADD COLUMN IF NOT EXISTS reason          text,
  ADD COLUMN IF NOT EXISTS bio             text,
  ADD COLUMN IF NOT EXISTS followers_count integer,
  ADD COLUMN IF NOT EXISTS following_count integer,
  ADD COLUMN IF NOT EXISTS account_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_pushed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS source          text;

COMMENT ON COLUMN repos.reason           IS 'LLM grade reason / skip reason';
COMMENT ON COLUMN repos.bio              IS 'GitHub user bio at time of evaluation';
COMMENT ON COLUMN repos.followers_count  IS 'GitHub followers count at time of evaluation';
COMMENT ON COLUMN repos.following_count  IS 'GitHub following count at time of evaluation';
COMMENT ON COLUMN repos.account_created_at IS 'GitHub account created_at';
COMMENT ON COLUMN repos.last_pushed_at   IS 'Most recent push_at across user repos at time of evaluation';
COMMENT ON COLUMN repos.source           IS 'Discovery source: search | trending | inbound | manual';
