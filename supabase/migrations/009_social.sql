-- Migration 009: Social / Friendships

-- ─── friendships ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Either party can view their own friendships
CREATE POLICY "Users see own friendships" ON friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Only requester can create (send a request)
CREATE POLICY "Requester can send" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Only addressee can accept/decline
CREATE POLICY "Addressee can respond" ON friendships
  FOR UPDATE USING (auth.uid() = addressee_id);

-- Either party can remove the friendship / cancel a request
CREATE POLICY "Either party can delete" ON friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ─── Allow users to search / view other profiles ──────────────────────────────
-- Without this policy, user search is impossible
DROP POLICY IF EXISTS "Profiles are searchable" ON profiles;
CREATE POLICY "Profiles are searchable" ON profiles
  FOR SELECT USING (true);
