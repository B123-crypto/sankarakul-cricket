ALTER TABLE deliveries
    ADD COLUMN IF NOT EXISTS is_boundary BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE deliveries
    ADD CONSTRAINT deliveries_boundary_runs_check
        CHECK (is_boundary = FALSE OR batter_runs IN (4, 6));
