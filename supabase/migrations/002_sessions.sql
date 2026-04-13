-- ============================================================
-- RepReady Phase 2 — Sessions & Transcript Schema
-- ============================================================
-- Run in Supabase SQL Editor after 001_initial.sql.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. sessions
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id       UUID        NOT NULL REFERENCES public.simulations (id) ON DELETE RESTRICT,
  simulation_version  INTEGER     NOT NULL,
  rep_id              UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'active', 'ended', 'evaluated')),
  openai_session_id   TEXT,
  persona_state       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 3 note: simulation_version stores the integer only, not the rubric snapshot.
-- The evaluator in Phase 3 should either join through simulation_versions using
-- (simulation_id, simulation_version) or store scoring_rubric as JSONB on this table
-- at call start time (recommended — more robust, survives simulation deletion).

CREATE INDEX IF NOT EXISTS idx_sessions_rep_id
  ON public.sessions (rep_id, created_at DESC);

DROP TRIGGER IF EXISTS set_sessions_updated_at ON public.sessions;
CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------
-- 2. transcript_turns
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcript_turns (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID        NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  turn_number          INTEGER     NOT NULL,
  speaker              TEXT        NOT NULL CHECK (speaker IN ('rep', 'persona')),
  content              TEXT        NOT NULL,
  persona_state_after  JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_turns_session
  ON public.transcript_turns (session_id, turn_number);

-- ---------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------
ALTER TABLE public.sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_turns ENABLE ROW LEVEL SECURITY;

-- sessions: reps can read/insert their own rows
CREATE POLICY "sessions_select_own_rep"
  ON public.sessions FOR SELECT
  USING (auth.uid() = rep_id);

CREATE POLICY "sessions_insert_own_rep"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = rep_id);

-- sessions: trainers and admins can read all
CREATE POLICY "sessions_select_trainer_admin"
  ON public.sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trainer', 'admin')
    )
  );

-- transcript_turns: reps can read/insert turns for their own sessions
CREATE POLICY "turns_select_own_rep"
  ON public.transcript_turns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
        AND sessions.rep_id = auth.uid()
    )
  );

CREATE POLICY "turns_insert_own_rep"
  ON public.transcript_turns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_id
        AND sessions.rep_id = auth.uid()
    )
  );

-- transcript_turns: trainers and admins can read all
CREATE POLICY "turns_select_trainer_admin"
  ON public.transcript_turns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trainer', 'admin')
    )
  );
