-- KoCo Database Schema for Supabase
-- Execute this SQL in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create tables
CREATE TABLE levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id UUID REFERENCES levels(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number >= 1 AND number <= 8),
  title_kr TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  UNIQUE(level_id, number)
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  number INTEGER NOT NULL CHECK (number IN (1, 2)),
  title_kr TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  grammar_points TEXT[] DEFAULT '{}',
  vocabulary_count INTEGER DEFAULT 0,
  UNIQUE(unit_id, number)
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  current_level TEXT DEFAULT '5A',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  score INTEGER DEFAULT 0,
  last_studied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('자유대화', '토론', '드릴')),
  duration_seconds INTEGER DEFAULT 0,
  speaking_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  corrected_text TEXT,
  error_type TEXT CHECK (error_type IN ('grammar', 'vocab', 'naturalness')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vocabulary_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  level_code TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'learning', 'mastered')),
  last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, word)
);

CREATE TABLE grammar_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  structure TEXT NOT NULL,
  level_code TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'learning', 'mastered')),
  last_practiced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, structure)
);

-- Insert initial data for levels
INSERT INTO levels (code, name, order_index) VALUES
('3A', 'SNU 3A', 1),
('3B', 'SNU 3B', 2),
('4A', 'SNU 4A', 3),
('4B', 'SNU 4B', 4),
('5A', 'SNU 5A', 5),
('5B', 'SNU 5B', 6),
('6A', 'SNU 6A', 7),
('6B', 'SNU 6B', 8);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_mastery ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User progress policies
CREATE POLICY "Users can view own progress" ON user_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON user_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Corrections policies
CREATE POLICY "Users can view own corrections" ON corrections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corrections" ON corrections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Vocabulary mastery policies
CREATE POLICY "Users can view own vocabulary mastery" ON vocabulary_mastery
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary mastery" ON vocabulary_mastery
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocabulary mastery" ON vocabulary_mastery
  FOR UPDATE USING (auth.uid() = user_id);

-- Grammar mastery policies
CREATE POLICY "Users can view own grammar mastery" ON grammar_mastery
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grammar mastery" ON grammar_mastery
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own grammar mastery" ON grammar_mastery
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow public read access to levels, units, and lessons
CREATE POLICY "Public read access to levels" ON levels FOR SELECT USING (true);
CREATE POLICY "Public read access to units" ON units FOR SELECT USING (true);
CREATE POLICY "Public read access to lessons" ON lessons FOR SELECT USING (true);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();