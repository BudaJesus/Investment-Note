-- ============================================
-- 자동 수집 데이터 테이블 (v2 - 발표일 포함)
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- 이미 auto_data 테이블이 있으면 ALTER만 실행됩니다
-- ============================================

-- 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS auto_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date_key TEXT NOT NULL UNIQUE,
  yahoo_data JSONB DEFAULT '{}',
  fred_data JSONB DEFAULT '{}',
  ecos_data JSONB DEFAULT '{}',
  release_dates JSONB DEFAULT '{}',
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- 이미 테이블이 있는데 release_dates 컬럼이 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auto_data' AND column_name='release_dates') THEN
    ALTER TABLE auto_data ADD COLUMN release_dates JSONB DEFAULT '{}';
  END IF;
END $$;

-- RLS 정책 (이미 있으면 무시됨)
ALTER TABLE auto_data ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auto_data' AND policyname='Anyone can read auto_data') THEN
    CREATE POLICY "Anyone can read auto_data" ON auto_data FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='auto_data' AND policyname='Service can write auto_data') THEN
    CREATE POLICY "Service can write auto_data" ON auto_data FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auto_data_date ON auto_data(date_key);
