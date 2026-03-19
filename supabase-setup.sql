-- ============================================
-- 투자 노트 — Supabase 테이블 설정
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- ============================================

-- 1. 데이터 저장 테이블 (key-value 방식)
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, key)
);

-- 2. Row Level Security 활성화 (내 데이터는 나만 접근)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 3. 정책 설정: 로그인한 사용자가 자기 데이터만 CRUD 가능
CREATE POLICY "Users can read own data"
  ON user_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  USING (auth.uid() = user_id);

-- 4. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. 인덱스 (검색 속도)
CREATE INDEX IF NOT EXISTS idx_user_data_user_key ON user_data(user_id, key);

-- 완료! 이제 앱에서 로그인하면 데이터가 여기에 저장됩니다.
