-- ============================================================
-- Phase 5: Persona voices
-- ============================================================

ALTER TABLE public.simulations
  ADD COLUMN IF NOT EXISTS persona_voice TEXT NOT NULL DEFAULT 'marin'
  CHECK (persona_voice IN ('alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'marin', 'sage', 'shimmer', 'verse'));

-- Backfill seeded starter personas on live simulations.
UPDATE public.simulations
SET persona_voice = CASE persona_name
  WHEN 'Karen Osei' THEN 'coral'
  WHEN 'David Park' THEN 'cedar'
  WHEN 'Priya Menon' THEN 'verse'
  WHEN 'Marcus Webb' THEN 'echo'
  WHEN 'Rachel Torres' THEN 'sage'
  ELSE COALESCE(NULLIF(persona_voice, ''), 'marin')
END;

-- Backfill starter templates so new simulations inherit a voice.
UPDATE public.simulation_templates
SET snapshot = jsonb_set(
  snapshot,
  '{persona_voice}',
  to_jsonb(
    CASE snapshot->>'persona_name'
      WHEN 'Karen Osei' THEN 'coral'
      WHEN 'David Park' THEN 'cedar'
      WHEN 'Priya Menon' THEN 'verse'
      WHEN 'Marcus Webb' THEN 'echo'
      WHEN 'Rachel Torres' THEN 'sage'
      ELSE COALESCE(NULLIF(snapshot->>'persona_voice', ''), 'marin')
    END
  ),
  true
);
