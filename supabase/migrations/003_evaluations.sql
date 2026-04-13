-- ============================================================
-- Phase 3: Evaluations
-- ============================================================

CREATE TABLE evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  overall_score integer NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  passed boolean NOT NULL,
  category_scores jsonb NOT NULL DEFAULT '[]',
  strengths text[] NOT NULL DEFAULT '{}',
  mistakes text[] NOT NULL DEFAULT '{}',
  missed_opportunities text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  evaluated_at timestamptz DEFAULT now(),
  evaluator_model text NOT NULL DEFAULT 'claude-sonnet-4-5'
);

CREATE INDEX evaluations_session_id_idx ON evaluations(session_id);

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Reps: can read evaluations for their own sessions
CREATE POLICY "reps_read_own_evaluations"
  ON evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = evaluations.session_id
        AND sessions.rep_id = auth.uid()
    )
  );

-- Trainers and admins: can read all evaluations
CREATE POLICY "trainers_admins_read_all_evaluations"
  ON evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('trainer', 'admin')
    )
  );

-- INSERT and UPDATE are service-role only (no client-facing policy)
-- The admin client (service role key) bypasses RLS entirely.
