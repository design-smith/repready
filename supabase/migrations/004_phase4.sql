-- ============================================================
-- Phase 4: Coaching hints, annotations, metrics, templates
-- ============================================================

CREATE TABLE coaching_hints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  turn_number integer NOT NULL,
  hint text NOT NULL,
  hint_type text CHECK (hint_type IN ('tip', 'warning', 'encouragement')) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE session_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  annotator_id uuid REFERENCES profiles(id) NOT NULL,
  turn_number integer,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE session_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  talk_ratio numeric NOT NULL,
  avg_response_time_ms integer,
  rep_turn_count integer NOT NULL,
  persona_turn_count integer NOT NULL,
  avg_rep_turn_length integer NOT NULL,
  filler_word_count integer NOT NULL,
  filler_words_found jsonb NOT NULL DEFAULT '{}',
  longest_monologue_words integer NOT NULL,
  question_count integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE simulation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Trigger for session_annotations updated_at
CREATE TRIGGER set_session_annotations_updated_at
  BEFORE UPDATE ON session_annotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

ALTER TABLE coaching_hints ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_templates ENABLE ROW LEVEL SECURITY;

-- coaching_hints: reps read own; trainers/admins read all; insert via service role
CREATE POLICY "reps_read_own_coaching_hints"
  ON coaching_hints FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = coaching_hints.session_id AND sessions.rep_id = auth.uid())
  );
CREATE POLICY "trainers_admins_read_all_coaching_hints"
  ON coaching_hints FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('trainer','admin'))
  );

-- session_annotations: trainers/admins INSERT/UPDATE/DELETE own rows; reps read own sessions
CREATE POLICY "trainers_admins_insert_annotations"
  ON session_annotations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('trainer','admin'))
    AND annotator_id = auth.uid()
  );
CREATE POLICY "trainers_admins_update_own_annotations"
  ON session_annotations FOR UPDATE TO authenticated
  USING (annotator_id = auth.uid())
  WITH CHECK (annotator_id = auth.uid());
CREATE POLICY "trainers_admins_delete_own_annotations"
  ON session_annotations FOR DELETE TO authenticated
  USING (annotator_id = auth.uid());
CREATE POLICY "trainers_admins_read_all_annotations"
  ON session_annotations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('trainer','admin'))
  );
CREATE POLICY "reps_read_own_session_annotations"
  ON session_annotations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_annotations.session_id AND sessions.rep_id = auth.uid())
  );

-- session_metrics: reps read own; trainers/admins read all; insert via service role
CREATE POLICY "reps_read_own_metrics"
  ON session_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_metrics.session_id AND sessions.rep_id = auth.uid())
  );
CREATE POLICY "trainers_admins_read_all_metrics"
  ON session_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('trainer','admin'))
  );

-- simulation_templates: all authenticated users can SELECT; trainers/admins can mutate
CREATE POLICY "all_read_templates"
  ON simulation_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "trainers_admins_mutate_templates"
  ON simulation_templates FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('trainer','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('trainer','admin'))
  );

-- ---------------------------------------------------------------
-- Seed: 5 starter simulation templates
-- ---------------------------------------------------------------

INSERT INTO simulation_templates (title, description, category, snapshot) VALUES

(
  'The Skeptical PBM',
  'A pharmacy benefits manager who is moderately satisfied with their current vendor. Goal: uncover latent dissatisfaction and earn a follow-up meeting.',
  'Discovery',
  '{
    "title": "The Skeptical PBM",
    "difficulty": "medium",
    "call_goal": "Uncover latent dissatisfaction with current vendor and earn a follow-up discovery meeting.",
    "persona_name": "Karen Osei",
    "persona_role": "VP of Pharmacy Benefits, MidWest Health",
    "persona_style": "Direct, data-oriented, skeptical of vendor claims. Speaks in short sentences. Asks for proof when you make claims.",
    "company_context": "MidWest Health is a regional health plan with 400,000 members. They have been with their current PBM for 6 years. Karen is broadly satisfied but has had minor friction around specialty drug prior auth turnaround times.",
    "opening_line": "Karen Osei speaking.",
    "hidden_objections": ["Current PBM relationship is personal — account manager is a friend", "Internal IT would need to approve any integration change, which takes 6+ months", "Board has approved current vendor contract through end of year"],
    "allowed_disclosures": ["Prior auth turnaround has been slower than expected this year", "They are open to exploring options for the next contract cycle"],
    "forbidden_disclosures": ["The account manager friendship", "The IT approval timeline"],
    "success_criteria": "Rep uncovers at least one specific pain point around prior auth or specialty pharmacy, earns agreement to a second meeting, and does not pitch product before establishing rapport.",
    "scoring_rubric": [
      {"name": "Discovery Quality", "weight": 8, "description": "Did rep ask open-ended questions to uncover real pain?"},
      {"name": "Rapport Building", "weight": 6, "description": "Did rep establish credibility without overselling?"},
      {"name": "Objection Handling", "weight": 5, "description": "Did rep handle resistance gracefully?"},
      {"name": "Next Step Secured", "weight": 7, "description": "Did rep secure a concrete follow-up commitment?"},
      {"name": "No Premature Pitch", "weight": 4, "description": "Did rep avoid pitching before understanding pain?"}
    ],
    "is_active": true,
    "hidden_objections_list": [],
    "allowed_disclosures_list": [],
    "forbidden_disclosures_list": []
  }'::jsonb
),

(
  'The Rushed CFO',
  'A CFO with 8 minutes on the call who pushes back on price immediately. Goal: handle cost objection, reframe on ROI, secure a longer meeting.',
  'Objection Handling',
  '{
    "title": "The Rushed CFO",
    "difficulty": "hard",
    "call_goal": "Handle cost objection, reframe discussion around ROI, and secure a dedicated 30-minute meeting with finance team.",
    "persona_name": "David Park",
    "persona_role": "CFO, Nexareon Group",
    "persona_style": "Impatient, numbers-first. Interrupts when bored. Only warms up if you speak his language: cost avoidance, payback period, IRR.",
    "company_context": "Nexareon is a 1,200-person professional services firm. David oversees a $40M tech budget and is under pressure to cut 8% this year. He took this call as a favor to a colleague.",
    "opening_line": "David Park. You have eight minutes.",
    "hidden_objections": ["Currently in Q4 budget freeze — no new vendor spend until January", "His VP of Ops already evaluated a competitor last quarter and passed", "David does not trust vendor ROI calculators — has been burned before"],
    "allowed_disclosures": ["They have had cost overruns on current software stack", "David is open to exploring if the payback period is under 12 months"],
    "forbidden_disclosures": ["The Q4 budget freeze", "The prior competitor evaluation"],
    "success_criteria": "Rep handles the immediate price objection without being defensive, pivots to ROI framing with a specific number, and books a follow-up meeting with finance team.",
    "scoring_rubric": [
      {"name": "Objection Reframe", "weight": 9, "description": "Did rep reframe price objection around ROI without getting defensive?"},
      {"name": "Specificity", "weight": 7, "description": "Did rep use specific numbers, not vague claims?"},
      {"name": "Conciseness", "weight": 6, "description": "Did rep respect the CFO time constraint and stay concise?"},
      {"name": "Next Step Secured", "weight": 8, "description": "Did rep book a follow-up meeting?"}
    ],
    "is_active": true,
    "hidden_objections_list": [],
    "allowed_disclosures_list": [],
    "forbidden_disclosures_list": []
  }'::jsonb
),

(
  'The Friendly Champion',
  'An enthusiastic internal champion who is not the decision-maker. Goal: identify the real decision process, map stakeholders, and advance the deal.',
  'Closing',
  '{
    "title": "The Friendly Champion",
    "difficulty": "medium",
    "call_goal": "Map the real decision process, identify all stakeholders involved in the final decision, and advance the deal to a formal evaluation.",
    "persona_name": "Priya Menon",
    "persona_role": "Director of Operations, Castleford Manufacturing",
    "persona_style": "Warm, enthusiastic, uses lots of ''we should definitely do this'' language. Deflects when asked about budget authority or who else needs to approve.",
    "company_context": "Castleford is a mid-market manufacturer. Priya has been a vocal advocate internally but the actual purchase needs sign-off from the CTO and CFO, neither of whom has been briefed.",
    "opening_line": "Oh great, I''m so glad you called! I''ve been talking about your product to everyone here.",
    "hidden_objections": ["CTO is skeptical of adding more SaaS tools — has a ''consolidation'' mandate", "CFO has not approved budget — Priya assumed it would be easy to get", "IT security review takes 8–12 weeks and has not been initiated"],
    "allowed_disclosures": ["She loves the product and has been demoing it internally", "She needs CTO and CFO sign-off before any purchase"],
    "forbidden_disclosures": ["CTO skepticism", "Budget not yet approved", "IT security review timeline"],
    "success_criteria": "Rep identifies the full buying committee (CTO, CFO, IT), secures introductions to at least two of them, and sets a formal multi-stakeholder meeting.",
    "scoring_rubric": [
      {"name": "Stakeholder Mapping", "weight": 9, "description": "Did rep identify all decision-makers without alienating the champion?"},
      {"name": "Champion Enablement", "weight": 7, "description": "Did rep give Priya tools/language to advocate internally?"},
      {"name": "Deal Advancement", "weight": 8, "description": "Did rep advance to a multi-stakeholder meeting?"},
      {"name": "Rapport", "weight": 4, "description": "Did rep maintain Priya''s enthusiasm throughout?"}
    ],
    "is_active": true,
    "hidden_objections_list": [],
    "allowed_disclosures_list": [],
    "forbidden_disclosures_list": []
  }'::jsonb
),

(
  'The Ghost Who Came Back',
  'A prospect who went dark after a demo 3 months ago and is now back on the phone. Goal: re-establish rapport, uncover what changed, and get back to a proposal.',
  'Discovery',
  '{
    "title": "The Ghost Who Came Back",
    "difficulty": "medium",
    "call_goal": "Understand why the prospect re-engaged, uncover what has changed in their situation, and get to a proposal or pilot.",
    "persona_name": "Marcus Webb",
    "persona_role": "VP of Sales Operations, Trident Logistics",
    "persona_style": "Apologetic but guarded. Will not explain why he went dark unless asked directly. Warms up quickly when rep shows genuine curiosity about what changed.",
    "company_context": "Trident Logistics went through a leadership change 3 months ago that froze all vendor decisions. New CEO approved a strategic initiative last week that makes the original problem urgent again. Marcus wants to move fast but is cautious about re-engaging after ghosting.",
    "opening_line": "Hey, I know it''s been a while. Thanks for picking up.",
    "hidden_objections": ["Embarrassed about going dark — does not want to explain it", "New CEO needs to approve vendors over $50K — new process", "Previous demo did not include a feature Marcus now needs"],
    "allowed_disclosures": ["There was a leadership change", "The original problem has become more urgent", "He is ready to move if the product meets the new requirement"],
    "forbidden_disclosures": ["CEO approval threshold", "The specific missing feature (unless directly asked)"],
    "success_criteria": "Rep acknowledges the gap without dwelling on it, discovers the new urgency driver, surfaces the new requirement, and advances to a revised proposal or targeted demo.",
    "scoring_rubric": [
      {"name": "Re-engagement Handling", "weight": 7, "description": "Did rep handle the gap gracefully without guilt-tripping?"},
      {"name": "Situation Discovery", "weight": 9, "description": "Did rep uncover what changed and why they are back?"},
      {"name": "Requirement Surfacing", "weight": 8, "description": "Did rep identify any new requirements?"},
      {"name": "Deal Advancement", "weight": 6, "description": "Did rep get to a clear next step?"}
    ],
    "is_active": true,
    "hidden_objections_list": [],
    "allowed_disclosures_list": [],
    "forbidden_disclosures_list": []
  }'::jsonb
),

(
  'The Multi-Vendor Evaluator',
  'A buyer actively evaluating 3 vendors and nearing a decision. Goal: differentiate clearly, handle competitive objections, and create urgency.',
  'Closing',
  '{
    "title": "The Multi-Vendor Evaluator",
    "difficulty": "hard",
    "call_goal": "Differentiate from 2 named competitors, handle price and feature objections, and create timeline urgency to push toward a decision.",
    "persona_name": "Rachel Torres",
    "persona_role": "Head of Procurement, Elevance Partners",
    "persona_style": "Methodical, fair, has a scorecard. Gives every vendor the same questions. Will share competitor weaknesses if asked the right way. Decision is in 3 weeks.",
    "company_context": "Elevance Partners is running a formal vendor evaluation. The two competitors are a well-known incumbent (cheaper but feature-lagging) and a newer startup (feature-rich but unproven at scale). Rachel''s scoring criteria are: implementation speed, integration depth, support quality, and total cost of ownership.",
    "opening_line": "Thanks for joining. I''ll be honest — you''re our third call this week on this evaluation.",
    "hidden_objections": ["One board member has a personal relationship with the incumbent vendor", "The startup competitor just offered a 40% discount to win the deal", "Rachel personally prefers the incumbent but knows it is feature-lagging"],
    "allowed_disclosures": ["The evaluation timeline is 3 weeks", "Implementation speed is the #1 criterion after a failed rollout with previous vendor", "Support quality is a close second — previous vendor''s support was poor"],
    "forbidden_disclosures": ["Board member relationship", "Competitor''s discount offer", "Rachel''s personal preference"],
    "success_criteria": "Rep surfaces and addresses the top two criteria (implementation speed, support quality), differentiates from both competitors on those dimensions, and creates a reason to decide in favor before the 3-week deadline.",
    "scoring_rubric": [
      {"name": "Competitive Differentiation", "weight": 9, "description": "Did rep clearly differentiate from named competitors?"},
      {"name": "Criteria Alignment", "weight": 8, "description": "Did rep address implementation speed and support quality specifically?"},
      {"name": "Urgency Creation", "weight": 7, "description": "Did rep create a legitimate reason to decide sooner?"},
      {"name": "Objection Handling", "weight": 6, "description": "Did rep handle price/feature objections without over-promising?"}
    ],
    "is_active": true,
    "hidden_objections_list": [],
    "allowed_disclosures_list": [],
    "forbidden_disclosures_list": []
  }'::jsonb
);
