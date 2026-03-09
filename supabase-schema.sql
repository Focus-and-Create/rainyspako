-- =========================================
-- Spanish Rain - Supabase 스키마
-- Supabase SQL Editor에서 실행하세요
-- =========================================

-- 유저 프로필 (auth.users를 확장)
CREATE TABLE user_profiles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT NOT NULL DEFAULT 'Player',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 스테이지 결과
CREATE TABLE stage_results (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stage_id TEXT NOT NULL,
    stars INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    last_accuracy INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, stage_id)
);

-- 유저 통계
CREATE TABLE user_stats (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    total_games INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_wrong INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    last_played TEXT,
    wrong_words JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 스테이지 점프 사용
CREATE TABLE jump_usage (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    used_today INTEGER DEFAULT 0,
    last_date TEXT DEFAULT ''
);

-- =========================================
-- Row Level Security (유저별 데이터 격리)
-- =========================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE jump_usage ENABLE ROW LEVEL SECURITY;

-- user_profiles: 자기 데이터만 CRUD
CREATE POLICY "users_own_profile" ON user_profiles
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- stage_results: 자기 데이터만 CRUD
CREATE POLICY "users_own_stages" ON stage_results
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- user_stats: 자기 데이터만 CRUD
CREATE POLICY "users_own_stats" ON user_stats
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- jump_usage: 자기 데이터만 CRUD
CREATE POLICY "users_own_jump" ON jump_usage
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =========================================
-- 자동 프로필 생성 (회원가입 시 트리거)
-- =========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
