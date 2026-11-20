import pool from "../config/db.js";

export const getTeams = async () => {
    const result = await pool.query(
        `SELECT
            t.id,
            t.name,
            t.short_name,
            t.created_at,
            t.updated_at,
            COUNT(p.id)::INTEGER AS player_count
         FROM teams AS t
         LEFT JOIN players AS p
            ON p.team_id = t.id
           AND p.is_active = TRUE
         GROUP BY t.id
         ORDER BY LOWER(t.name), t.id`
    );

    return result.rows;
};

export const getTeamById = async (id) => {
    const result = await pool.query(
        `SELECT id, name, short_name, created_at, updated_at
         FROM teams
         WHERE id = $1`,
        [id]
    );

    return result.rows[0];
};

export const createTeam = async (name, shortName) => {
    const result = await pool.query(
        `INSERT INTO teams (name, short_name)
         VALUES ($1, $2)
         RETURNING id, name, short_name, created_at, updated_at`,
        [name, shortName]
    );

    return result.rows[0];
};

export const updateTeam = async (id, name, shortName) => {
    const result = await pool.query(
        `UPDATE teams
         SET name = COALESCE($1, name),
             short_name = COALESCE($2, short_name),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, short_name, created_at, updated_at`,
        [name, shortName, id]
    );

    return result.rows[0];
};

export const getPlayersByTeam = async (teamId, includeInactive = false) => {
    const result = await pool.query(
        `SELECT id, team_id, name, role, jersey_number, is_active, created_at, updated_at
         FROM players
         WHERE team_id = $1
           AND ($2::BOOLEAN OR is_active = TRUE)
         ORDER BY name, id`,
        [teamId, includeInactive]
    );

    return result.rows;
};

export const createPlayer = async (teamId, name, role, jerseyNumber) => {
    const result = await pool.query(
        `INSERT INTO players (team_id, name, role, jersey_number)
         VALUES ($1, $2, $3, $4)
         RETURNING id, team_id, name, role, jersey_number, is_active, created_at, updated_at`,
        [teamId, name, role, jerseyNumber]
    );

    return result.rows[0];
};

export const updatePlayer = async (id, name, role, jerseyNumber, isActive) => {
    const result = await pool.query(
        `UPDATE players
         SET name = COALESCE($1, name),
             role = COALESCE($2, role),
             jersey_number = CASE WHEN $3::BOOLEAN THEN $4 ELSE jersey_number END,
             is_active = COALESCE($5, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING id, team_id, name, role, jersey_number, is_active, created_at, updated_at`,
        [
            name,
            role,
            jerseyNumber.provided,
            jerseyNumber.value,
            isActive,
            id
        ]
    );

    return result.rows[0];
};
