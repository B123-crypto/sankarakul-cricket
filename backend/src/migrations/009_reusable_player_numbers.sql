ALTER TABLE players
    DROP CONSTRAINT IF EXISTS players_team_id_jersey_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS players_active_jersey_unique_idx
    ON players (team_id, jersey_number)
    WHERE is_active = TRUE
      AND jersey_number IS NOT NULL;
