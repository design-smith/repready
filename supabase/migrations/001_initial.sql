-- ============================================================
-- RepReady Phase 1 — Initial Schema
-- ============================================================
-- Run in Supabase SQL Editor or via the Supabase CLI:
--   supabase db push
-- ============================================================

-- ---------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'rep'
                          CHECK (role IN ('admin', 'trainer', 'rep')),
  full_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a profile row whenever a new auth user is inserted.
-- To promote a user to trainer/admin, update their row in profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'rep')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------
-- 2. simulations
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT        NOT NULL,
  difficulty           TEXT        NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  call_goal            TEXT        NOT NULL,
  persona_name         TEXT        NOT NULL,
  persona_role         TEXT        NOT NULL,
  persona_style        TEXT        NOT NULL,
  company_context      TEXT        NOT NULL,
  opening_line         TEXT        NOT NULL,
  hidden_objections    TEXT[]      NOT NULL DEFAULT '{}',
  allowed_disclosures  TEXT[]      NOT NULL DEFAULT '{}',
  forbidden_disclosures TEXT[]     NOT NULL DEFAULT '{}',
  success_criteria     TEXT        NOT NULL,
  -- scoring_rubric: [{ name, weight, description }]
  scoring_rubric       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  version              INTEGER     NOT NULL DEFAULT 1,
  created_by           UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 3. simulation_versions
-- ---------------------------------------------------------------
-- Each row is a full snapshot of a simulation before an edit.
-- Inserts are handled server-side (API route with service role key).
CREATE TABLE IF NOT EXISTS public.simulation_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id  UUID        NOT NULL REFERENCES public.simulations (id) ON DELETE CASCADE,
  version        INTEGER     NOT NULL,
  snapshot       JSONB       NOT NULL,
  created_by     UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulation_versions_sim_id
  ON public.simulation_versions (simulation_id, version DESC);

-- ---------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_versions  ENABLE ROW LEVEL SECURITY;

-- profiles: each user can read and update their own row
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- simulations: trainers and admins can read all; reps only see active ones
CREATE POLICY "simulations_select_trainer_admin"
  ON public.simulations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trainer', 'admin')
    )
  );

CREATE POLICY "simulations_select_rep_active"
  ON public.simulations FOR SELECT
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'rep'
    )
  );

CREATE POLICY "simulations_insert_trainer_admin"
  ON public.simulations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trainer', 'admin')
    )
  );

CREATE POLICY "simulations_update_trainer_admin"
  ON public.simulations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trainer', 'admin')
    )
  );

-- simulation_versions: trainers and admins can read; no client inserts (API only)
CREATE POLICY "sim_versions_select_trainer_admin"
  ON public.simulation_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trainer', 'admin')
    )
  );

-- ---------------------------------------------------------------
-- 5. Helper: update updated_at automatically
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_simulations_updated_at ON public.simulations;
CREATE TRIGGER set_simulations_updated_at
  BEFORE UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
