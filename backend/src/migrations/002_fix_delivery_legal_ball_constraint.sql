UPDATE deliveries
SET legal_ball = TRUE
WHERE extras_type IS NULL
  AND legal_ball = FALSE;

ALTER TABLE deliveries
    DROP CONSTRAINT IF EXISTS deliveries_legal_ball_consistency;

ALTER TABLE deliveries
    ADD CONSTRAINT deliveries_legal_ball_consistency CHECK (
        (
            extras_type IS NOT NULL
            AND extras_type IN ('wide', 'no_ball')
            AND legal_ball = FALSE
        )
        OR
        (
            (extras_type IS NULL OR extras_type NOT IN ('wide', 'no_ball'))
            AND legal_ball = TRUE
        )
    );
