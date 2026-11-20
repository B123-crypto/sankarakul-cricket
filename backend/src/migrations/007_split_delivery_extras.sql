ALTER TABLE deliveries
    ADD COLUMN IF NOT EXISTS wide_runs SMALLINT NOT NULL DEFAULT 0
        CHECK (wide_runs BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS no_ball_runs SMALLINT NOT NULL DEFAULT 0
        CHECK (no_ball_runs BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS bye_runs SMALLINT NOT NULL DEFAULT 0
        CHECK (bye_runs BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS leg_bye_runs SMALLINT NOT NULL DEFAULT 0
        CHECK (leg_bye_runs BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS penalty_runs SMALLINT NOT NULL DEFAULT 0
        CHECK (penalty_runs BETWEEN 0 AND 100);

UPDATE deliveries
SET
    wide_runs = CASE WHEN extras_type = 'wide' THEN extras_runs ELSE wide_runs END,
    no_ball_runs = CASE WHEN extras_type = 'no_ball' THEN extras_runs ELSE no_ball_runs END,
    bye_runs = CASE WHEN extras_type = 'bye' THEN extras_runs ELSE bye_runs END,
    leg_bye_runs = CASE WHEN extras_type = 'leg_bye' THEN extras_runs ELSE leg_bye_runs END,
    penalty_runs = CASE WHEN extras_type = 'penalty' THEN extras_runs ELSE penalty_runs END;

ALTER TABLE deliveries
    DROP CONSTRAINT IF EXISTS deliveries_legal_ball_consistency,
    ADD CONSTRAINT deliveries_extra_runs_consistency CHECK (
        wide_runs + no_ball_runs + bye_runs + leg_bye_runs + penalty_runs <= 100
        AND NOT (wide_runs > 0 AND no_ball_runs > 0)
        AND NOT (bye_runs > 0 AND leg_bye_runs > 0)
        AND (wide_runs = 0 OR (bye_runs = 0 AND leg_bye_runs = 0))
        AND (
            batter_runs = 0
            OR (wide_runs = 0 AND bye_runs = 0 AND leg_bye_runs = 0)
        )
    ),
    ADD CONSTRAINT deliveries_legal_ball_consistency CHECK (
        legal_ball = (wide_runs = 0 AND no_ball_runs = 0)
    );
