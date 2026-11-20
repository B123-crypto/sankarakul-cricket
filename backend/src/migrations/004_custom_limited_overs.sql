DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM matches
        WHERE format = 'TEST'
           OR overs_per_innings IS NULL
           OR overs_per_innings NOT BETWEEN 1 AND 100
    ) THEN
        RAISE EXCEPTION
            'Existing matches must be converted to limited overs (1-100 overs) before this migration';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM innings
        WHERE innings_number NOT BETWEEN 1 AND 2
    ) THEN
        RAISE EXCEPTION
            'Existing innings beyond number 2 must be resolved before this migration';
    END IF;
END;
$$;

ALTER TABLE matches
    DROP CONSTRAINT IF EXISTS matches_format_check,
    DROP CONSTRAINT IF EXISTS matches_status_check,
    DROP CONSTRAINT IF EXISTS matches_check,
    DROP CONSTRAINT IF EXISTS matches_check1;

ALTER TABLE matches
    ALTER COLUMN format SET DEFAULT 'CUSTOM',
    ALTER COLUMN overs_per_innings SET NOT NULL,
    ADD CONSTRAINT matches_format_check
        CHECK (format IN ('CUSTOM', 'T10', 'T20', 'ODI')),
    ADD CONSTRAINT matches_status_check
        CHECK (status IN ('scheduled', 'live', 'completed', 'abandoned')),
    ADD CONSTRAINT matches_distinct_teams_check
        CHECK (home_team_id <> away_team_id),
    ADD CONSTRAINT matches_limited_overs_check
        CHECK (overs_per_innings BETWEEN 1 AND 100);

ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS winner_team_id BIGINT REFERENCES teams(id),
    ADD COLUMN IF NOT EXISTS result_text TEXT,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE innings
    DROP CONSTRAINT IF EXISTS innings_innings_number_check;

ALTER TABLE innings
    ADD CONSTRAINT innings_limited_overs_number_check
        CHECK (innings_number BETWEEN 1 AND 2),
    ADD COLUMN IF NOT EXISTS total_runs INTEGER NOT NULL DEFAULT 0
        CHECK (total_runs >= 0),
    ADD COLUMN IF NOT EXISTS wickets SMALLINT NOT NULL DEFAULT 0
        CHECK (wickets BETWEEN 0 AND 10),
    ADD COLUMN IF NOT EXISTS legal_balls INTEGER NOT NULL DEFAULT 0
        CHECK (legal_balls >= 0),
    ADD COLUMN IF NOT EXISTS current_striker_id BIGINT REFERENCES players(id),
    ADD COLUMN IF NOT EXISTS current_non_striker_id BIGINT REFERENCES players(id),
    ADD COLUMN IF NOT EXISTS current_bowler_id BIGINT REFERENCES players(id);

ALTER TABLE deliveries
    ADD COLUMN IF NOT EXISTS next_striker_id BIGINT REFERENCES players(id),
    ADD COLUMN IF NOT EXISTS next_non_striker_id BIGINT REFERENCES players(id);

UPDATE innings AS i
SET
    total_runs = COALESCE(score.total_runs, 0),
    wickets = COALESCE(score.wickets, 0),
    legal_balls = COALESCE(score.legal_balls, 0)
FROM (
    SELECT
        innings_id,
        SUM(batter_runs + extras_runs)::INTEGER AS total_runs,
        COUNT(*) FILTER (WHERE wicket_type IS NOT NULL)::SMALLINT AS wickets,
        COUNT(*) FILTER (WHERE legal_ball)::INTEGER AS legal_balls
    FROM deliveries
    GROUP BY innings_id
) AS score
WHERE i.id = score.innings_id;

CREATE UNIQUE INDEX IF NOT EXISTS innings_one_live_per_match_idx
    ON innings (match_id)
    WHERE status = 'live';

CREATE INDEX IF NOT EXISTS matches_winner_idx
    ON matches (winner_team_id)
    WHERE winner_team_id IS NOT NULL;
