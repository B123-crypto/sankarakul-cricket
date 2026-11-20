ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS max_overs_per_bowler INTEGER;

UPDATE matches
SET max_overs_per_bowler = CEIL(overs_per_innings / 5.0)::INTEGER
WHERE max_overs_per_bowler IS NULL;

ALTER TABLE matches
    ALTER COLUMN max_overs_per_bowler SET NOT NULL,
    ADD CONSTRAINT matches_bowler_overs_limit_check
        CHECK (
            max_overs_per_bowler BETWEEN 1 AND overs_per_innings
        );
