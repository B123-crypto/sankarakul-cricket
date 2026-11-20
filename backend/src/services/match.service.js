import pool from "../config/db.js";
import {
    getDefaultBowlerOverLimit,
    getDeliveryTotals,
    isInningsComplete
} from "./cricket.rules.js";

const createError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const withTransaction = async (operation) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await operation(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Match transaction rollback failed:", rollbackError);
        }
        throw error;
    } finally {
        client.release();
    }
};

const getMatchSummaryQuery = `
    SELECT
        m.id,
        m.format,
        m.status,
        m.venue,
        m.scheduled_at,
        m.overs_per_innings,
        m.max_overs_per_bowler,
        m.result_text,
        m.winner_team_id,
        m.started_at,
        m.completed_at,
        m.created_at,
        home.id AS home_team_id,
        home.name AS home_team_name,
        home.short_name AS home_team_short_name,
        away.id AS away_team_id,
        away.name AS away_team_name,
        away.short_name AS away_team_short_name,
        current_innings.id AS current_innings_id,
        current_innings.innings_number AS current_innings_number,
        current_innings.batting_team_id AS current_batting_team_id,
        current_innings.total_runs AS current_total_runs,
        current_innings.wickets AS current_wickets,
        current_innings.legal_balls AS current_legal_balls,
        current_innings.target_runs AS current_target_runs,
        current_innings.status AS current_innings_status
    FROM matches AS m
    JOIN teams AS home ON home.id = m.home_team_id
    JOIN teams AS away ON away.id = m.away_team_id
    LEFT JOIN LATERAL (
        SELECT i.*
        FROM innings AS i
        WHERE i.match_id = m.id
        ORDER BY i.innings_number DESC
        LIMIT 1
    ) AS current_innings ON TRUE
`;

export const getMatches = async (status) => {
    const result = await pool.query(
        `${getMatchSummaryQuery}
         WHERE ($1::TEXT IS NULL OR m.status = $1)
         ORDER BY COALESCE(m.scheduled_at, m.created_at) DESC, m.id DESC`,
        [status]
    );

    return result.rows;
};

export const getMatchById = async (id, deliveryLimit = 200) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY");
        const matchResult = await client.query(
            `${getMatchSummaryQuery}
             WHERE m.id = $1`,
            [id]
        );
        const match = matchResult.rows[0];

        if (!match) {
            await client.query("COMMIT");
            return undefined;
        }

        const inningsResult = await client.query(
            `SELECT
                i.id,
                i.innings_number,
                i.batting_team_id,
                batting.name AS batting_team_name,
                i.bowling_team_id,
                bowling.name AS bowling_team_name,
                i.status,
                i.total_runs,
                i.wickets,
                i.legal_balls,
                i.target_runs,
                i.started_at,
                i.completed_at,
                i.current_striker_id,
                striker.name AS current_striker_name,
                i.current_non_striker_id,
                non_striker.name AS current_non_striker_name,
                i.current_bowler_id,
                bowler.name AS current_bowler_name
             FROM innings AS i
             JOIN teams AS batting ON batting.id = i.batting_team_id
             JOIN teams AS bowling ON bowling.id = i.bowling_team_id
             LEFT JOIN players AS striker ON striker.id = i.current_striker_id
             LEFT JOIN players AS non_striker ON non_striker.id = i.current_non_striker_id
             LEFT JOIN players AS bowler ON bowler.id = i.current_bowler_id
             WHERE i.match_id = $1
             ORDER BY i.innings_number`,
            [id]
        );

        const innings = [];
        for (const inning of inningsResult.rows) {
            const batting = await client.query(
                `SELECT
                    p.id AS player_id,
                    p.name AS player_name,
                    COALESCE(SUM(d.batter_runs), 0)::INTEGER AS runs,
                    COUNT(*) FILTER (
                        WHERE d.wide_runs = 0
                    )::INTEGER AS balls_faced,
                    COUNT(*) FILTER (
                        WHERE d.is_boundary AND d.batter_runs = 4
                    )::INTEGER AS fours,
                    COUNT(*) FILTER (
                        WHERE d.is_boundary AND d.batter_runs = 6
                    )::INTEGER AS sixes,
                    COALESCE(BOOL_OR(d.dismissed_player_id = p.id), FALSE) AS is_out,
                    (
                        COALESCE(SUM(d.batter_runs), 0) * 100.0
                        / NULLIF(COUNT(*) FILTER (
                            WHERE d.wide_runs = 0
                        ), 0)
                    ) AS strike_rate
                 FROM deliveries AS d
                 JOIN players AS p ON p.id = d.striker_id
                 WHERE d.innings_id = $1
                 GROUP BY p.id
                 ORDER BY runs DESC, p.name`,
                [inning.id]
            );
            const bowling = await client.query(
                `SELECT
                    p.id AS player_id,
                    p.name AS player_name,
                    COUNT(*) FILTER (WHERE d.legal_ball)::INTEGER AS legal_balls,
                    COALESCE(SUM(
                        d.batter_runs + d.wide_runs + d.no_ball_runs
                    ), 0)::INTEGER AS runs_conceded,
                    COUNT(*) FILTER (
                        WHERE d.wicket_type IN (
                            'bowled', 'caught', 'lbw', 'stumped', 'hit_wicket'
                        )
                    )::INTEGER AS wickets,
                    (
                        COALESCE(SUM(
                            d.batter_runs + d.wide_runs + d.no_ball_runs
                        ), 0) * 6.0
                        / NULLIF(COUNT(*) FILTER (WHERE d.legal_ball), 0)
                    ) AS economy
                 FROM deliveries AS d
                 JOIN players AS p ON p.id = d.bowler_id
                 WHERE d.innings_id = $1
                 GROUP BY p.id
                 ORDER BY wickets DESC, runs_conceded, p.name`,
                [inning.id]
            );
            const extras = await client.query(
                `SELECT extras_type, SUM(runs)::INTEGER AS runs
                 FROM (
                    SELECT 'wide' AS extras_type, wide_runs AS runs
                    FROM deliveries
                    WHERE innings_id = $1 AND wide_runs > 0
                    UNION ALL
                    SELECT 'no_ball', no_ball_runs
                    FROM deliveries
                    WHERE innings_id = $1 AND no_ball_runs > 0
                    UNION ALL
                    SELECT 'bye', bye_runs
                    FROM deliveries
                    WHERE innings_id = $1 AND bye_runs > 0
                    UNION ALL
                    SELECT 'leg_bye', leg_bye_runs
                    FROM deliveries
                    WHERE innings_id = $1 AND leg_bye_runs > 0
                    UNION ALL
                    SELECT 'penalty', penalty_runs
                    FROM deliveries
                    WHERE innings_id = $1 AND penalty_runs > 0
                 ) AS extras
                 GROUP BY extras_type
                 ORDER BY extras_type`,
                [inning.id]
            );
            const deliveries = await client.query(
                `SELECT
                    d.delivery_number,
                    d.striker_id,
                    striker.name AS striker_name,
                    d.non_striker_id,
                    non_striker.name AS non_striker_name,
                    d.bowler_id,
                    bowler.name AS bowler_name,
                    d.batter_runs,
                    d.is_boundary,
                    d.wide_runs,
                    d.no_ball_runs,
                    d.bye_runs,
                    d.leg_bye_runs,
                    d.penalty_runs,
                    d.extras_runs AS total_extras,
                    d.legal_ball,
                    d.batter_runs + d.wide_runs + d.no_ball_runs
                        + d.bye_runs + d.leg_bye_runs + d.penalty_runs AS total_runs,
                    d.wicket_type,
                    d.dismissed_player_id,
                    dismissed.name AS dismissed_player_name,
                    d.created_at
                 FROM (
                    SELECT *
                    FROM deliveries
                    WHERE innings_id = $1
                    ORDER BY delivery_number DESC
                    LIMIT $2
                 ) AS d
                 JOIN players AS striker ON striker.id = d.striker_id
                 JOIN players AS non_striker ON non_striker.id = d.non_striker_id
                 JOIN players AS bowler ON bowler.id = d.bowler_id
                 LEFT JOIN players AS dismissed ON dismissed.id = d.dismissed_player_id
                 ORDER BY d.delivery_number`,
                [inning.id, deliveryLimit]
            );

            innings.push({
                ...inning,
                batting: batting.rows,
                bowling: bowling.rows,
                extras: extras.rows,
                deliveries: deliveries.rows
            });
        }

        await client.query("COMMIT");
        return { ...match, innings };
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Match read rollback failed:", rollbackError);
        }
        throw error;
    } finally {
        client.release();
    }
};

export const createMatch = async ({
    homeTeamId,
    awayTeamId,
    format,
    oversPerInnings,
    maxOversPerBowler,
    venue,
    scheduledAt
}) => {
    const result = await pool.query(
        `INSERT INTO matches (
            home_team_id,
            away_team_id,
            format,
            overs_per_innings,
            max_overs_per_bowler,
            venue,
            scheduled_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
            homeTeamId,
            awayTeamId,
            format,
            oversPerInnings,
            maxOversPerBowler ?? getDefaultBowlerOverLimit(oversPerInnings),
            venue,
            scheduledAt
        ]
    );

    return getMatchById(result.rows[0].id);
};

export const updateScheduledMatch = async (id, {
    format,
    oversPerInnings,
    maxOversPerBowler,
    venue,
    scheduledAt
}) => {
    const result = await pool.query(
        `UPDATE matches
         SET format = COALESCE($1, format),
             overs_per_innings = COALESCE($2, overs_per_innings),
             max_overs_per_bowler = COALESCE($3, max_overs_per_bowler),
             venue = CASE WHEN $4::BOOLEAN THEN $5 ELSE venue END,
             scheduled_at = CASE WHEN $6::BOOLEAN THEN $7 ELSE scheduled_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
           AND status = 'scheduled'
         RETURNING id`,
        [
            format,
            oversPerInnings,
            maxOversPerBowler,
            venue.provided,
            venue.value,
            scheduledAt.provided,
            scheduledAt.value,
            id
        ]
    );

    return result.rows[0] ? getMatchById(id) : undefined;
};

const getPlayersForInnings = async (client, playerIds) => {
    const result = await client.query(
        `SELECT id, team_id, is_active
         FROM players
         WHERE id = ANY($1::BIGINT[])`,
        [playerIds]
    );

    return new Map(result.rows.map((player) => [String(player.id), player]));
};

const assertOpenersAndBowler = async (
    client,
    { battingTeamId, bowlingTeamId, strikerId, nonStrikerId, bowlerId }
) => {
    if (strikerId === nonStrikerId) {
        throw createError(400, "Opening batters must be different players");
    }

    const players = await getPlayersForInnings(client, [
        strikerId,
        nonStrikerId,
        bowlerId
    ]);

    const striker = players.get(strikerId);
    const nonStriker = players.get(nonStrikerId);
    const bowler = players.get(bowlerId);

    if (
        !striker?.is_active ||
        !nonStriker?.is_active ||
        striker.team_id !== String(battingTeamId) ||
        nonStriker.team_id !== String(battingTeamId) ||
        !bowler?.is_active ||
        bowler.team_id !== String(bowlingTeamId)
    ) {
        throw createError(400, "Opening players must be active members of the correct teams");
    }
};

export const startMatch = async (matchId, {
    battingTeamId,
    strikerId,
    nonStrikerId,
    bowlerId
}) => {
    await withTransaction(async (client) => {
        const matchResult = await client.query(
            `SELECT *
             FROM matches
             WHERE id = $1
             FOR UPDATE`,
            [matchId]
        );
        const match = matchResult.rows[0];

        if (!match) {
            throw createError(404, "Match not found");
        }
        if (match.status !== "scheduled") {
            throw createError(409, "Only a scheduled match can be started");
        }
        if (
            battingTeamId !== String(match.home_team_id) &&
            battingTeamId !== String(match.away_team_id)
        ) {
            throw createError(400, "Batting first must be one of the match teams");
        }

        const bowlingTeamId = String(
            battingTeamId === String(match.home_team_id)
                ? match.away_team_id
                : match.home_team_id
        );

        await assertOpenersAndBowler(client, {
            battingTeamId,
            bowlingTeamId,
            strikerId,
            nonStrikerId,
            bowlerId
        });

        await client.query(
            `INSERT INTO innings (
                match_id,
                innings_number,
                batting_team_id,
                bowling_team_id,
                status,
                started_at,
                current_striker_id,
                current_non_striker_id,
                current_bowler_id
             )
             VALUES ($1, 1, $2, $3, 'live', CURRENT_TIMESTAMP, $4, $5, $6)`,
            [matchId, battingTeamId, bowlingTeamId, strikerId, nonStrikerId, bowlerId]
        );

        await client.query(
            `UPDATE matches
             SET status = 'live',
                 started_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [matchId]
        );
    });

    return getMatchById(matchId);
};

export const startSecondInnings = async (matchId, {
    strikerId,
    nonStrikerId,
    bowlerId
}) => {
    await withTransaction(async (client) => {
        const matchResult = await client.query(
            `SELECT *
             FROM matches
             WHERE id = $1
             FOR UPDATE`,
            [matchId]
        );
        const match = matchResult.rows[0];

        if (!match) {
            throw createError(404, "Match not found");
        }
        if (match.status !== "live") {
            throw createError(409, "Match is not accepting another innings");
        }

        const firstInningsResult = await client.query(
            `SELECT *
             FROM innings
             WHERE match_id = $1
               AND innings_number = 1
             FOR UPDATE`,
            [matchId]
        );
        const firstInnings = firstInningsResult.rows[0];

        if (!firstInnings || firstInnings.status !== "completed") {
            throw createError(409, "The first innings must be completed first");
        }

        const alreadyStarted = await client.query(
            "SELECT 1 FROM innings WHERE match_id = $1 AND innings_number = 2",
            [matchId]
        );

        if (alreadyStarted.rows.length > 0) {
            throw createError(409, "The second innings has already started");
        }

        await assertOpenersAndBowler(client, {
            battingTeamId: String(firstInnings.bowling_team_id),
            bowlingTeamId: String(firstInnings.batting_team_id),
            strikerId,
            nonStrikerId,
            bowlerId
        });

        await client.query(
            `INSERT INTO innings (
                match_id,
                innings_number,
                batting_team_id,
                bowling_team_id,
                status,
                target_runs,
                started_at,
                current_striker_id,
                current_non_striker_id,
                current_bowler_id
             )
             VALUES ($1, 2, $2, $3, 'live', $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
            [
                matchId,
                firstInnings.bowling_team_id,
                firstInnings.batting_team_id,
                Number(firstInnings.total_runs) + 1,
                strikerId,
                nonStrikerId,
                bowlerId
            ]
        );
    });

    return getMatchById(matchId);
};

const getWinner = async (client, matchId) => {
    const inningsResult = await client.query(
        `SELECT i.total_runs, i.wickets, i.batting_team_id, t.name AS team_name
         FROM innings AS i
         JOIN teams AS t ON t.id = i.batting_team_id
         WHERE i.match_id = $1
         ORDER BY i.innings_number`,
        [matchId]
    );
    const first = inningsResult.rows[0];
    const second = inningsResult.rows[1];

    if (Number(second.total_runs) > Number(first.total_runs)) {
        const wicketsRemaining = Math.max(0, 10 - Number(second.wickets));
        return {
            winnerTeamId: second.batting_team_id,
            text: `${second.team_name} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}`
        };
    }

    if (Number(second.total_runs) === Number(first.total_runs)) {
        return { winnerTeamId: null, text: "Match tied" };
    }

    return {
        winnerTeamId: first.batting_team_id,
        text: `${first.team_name} won by ${Number(first.total_runs) - Number(second.total_runs)} run${Number(first.total_runs) - Number(second.total_runs) === 1 ? "" : "s"}`
    };
};

export const addDelivery = async (inningsId, delivery) => {
    await withTransaction(async (client) => {
        const inningsResult = await client.query(
            `SELECT
                i.*,
                m.overs_per_innings,
                m.max_overs_per_bowler,
                m.status AS match_status
             FROM innings AS i
             JOIN matches AS m ON m.id = i.match_id
             WHERE i.id = $1
             FOR UPDATE OF i, m`,
            [inningsId]
        );
        const innings = inningsResult.rows[0];

        if (!innings) {
            throw createError(404, "Innings not found");
        }
        if (innings.status !== "live" || innings.match_status !== "live") {
            throw createError(409, "Innings is not live");
        }
        if (!innings.current_striker_id || !innings.current_non_striker_id) {
            throw createError(409, "Current batters are not set");
        }
        if (String(innings.current_striker_id) === String(innings.current_non_striker_id)) {
            throw createError(409, "Current batters must be different");
        }

        const { legalBall, extrasRuns, totalRuns } = getDeliveryTotals(delivery);
        if (delivery.extras.wide > 0 && delivery.batterRuns !== 0) {
            throw createError(400, "Batter runs cannot be scored from a wide");
        }
        if (
            (delivery.extras.bye > 0 || delivery.extras.legBye > 0) &&
            delivery.batterRuns !== 0
        ) {
            throw createError(400, "Bye and leg-bye deliveries cannot include batter runs");
        }
        if (
            delivery.extras.noBall > 0 &&
            delivery.wicketType &&
            !["run_out", "obstructing_field", "hit_ball_twice"].includes(
                delivery.wicketType
            )
        ) {
            throw createError(400, "That dismissal is not valid from a no-ball");
        }
        if (
            delivery.wicketType &&
            delivery.extras.wide > 0 &&
            !["run_out", "stumped", "hit_wicket", "obstructing_field"].includes(delivery.wicketType)
        ) {
            throw createError(400, "That dismissal is not valid from a wide");
        }

        const nextLegalBalls = Number(innings.legal_balls) + (legalBall ? 1 : 0);
        const nextTotalRuns = Number(innings.total_runs) + totalRuns;
        const nextWickets = Number(innings.wickets) + (delivery.wicketType ? 1 : 0);
        const allOut = nextWickets >= 10;
        const isCompleted = isInningsComplete({
            legalBalls: nextLegalBalls,
            oversPerInnings: Number(innings.overs_per_innings),
            wickets: nextWickets,
            totalRuns: nextTotalRuns,
            targetRuns:
                innings.target_runs === null
                    ? null
                    : Number(innings.target_runs)
        });

        const newBatterIds = [
            delivery.nextStrikerId,
            delivery.nextNonStrikerId
        ].filter(Boolean);
        const playerIds = [
            String(innings.current_striker_id),
            String(innings.current_non_striker_id),
            delivery.bowlerId,
            delivery.dismissedPlayerId,
            ...newBatterIds
        ].filter(Boolean);
        const players = await getPlayersForInnings(client, [...new Set(playerIds)]);
        const striker = players.get(String(innings.current_striker_id));
        const nonStriker = players.get(String(innings.current_non_striker_id));
        const bowler = players.get(delivery.bowlerId);
        const bowlerStartingOver = !innings.current_bowler_id;

        if (
            innings.current_bowler_id &&
            String(innings.current_bowler_id) !== delivery.bowlerId
        ) {
            throw createError(409, "A bowler cannot change before the over is complete");
        }

        if (
            !striker ||
            !nonStriker ||
            striker.team_id !== String(innings.batting_team_id) ||
            nonStriker.team_id !== String(innings.batting_team_id) ||
            !bowler ||
            (bowlerStartingOver && !bowler.is_active) ||
            bowler.team_id !== String(innings.bowling_team_id)
        ) {
            throw createError(400, "Delivery players must belong to the correct match teams");
        }

        const bowlerBallsResult = await client.query(
            `SELECT COUNT(*) FILTER (WHERE legal_ball)::INTEGER AS legal_balls
             FROM deliveries
             WHERE innings_id = $1
               AND bowler_id = $2`,
            [inningsId, delivery.bowlerId]
        );
        const bowlerLegalBalls =
            Number(bowlerBallsResult.rows[0].legal_balls) + (legalBall ? 1 : 0);
        const bowlerBallLimit = Number(innings.max_overs_per_bowler) * 6;
        if (
            (bowlerStartingOver &&
                Number(bowlerBallsResult.rows[0].legal_balls) >= bowlerBallLimit) ||
            bowlerLegalBalls > bowlerBallLimit
        ) {
            throw createError(409, "Bowler has reached the configured over limit");
        }

        if (delivery.wicketType) {
            const dismissedId = delivery.dismissedPlayerId;
            if (
                dismissedId !== String(innings.current_striker_id) &&
                dismissedId !== String(innings.current_non_striker_id)
            ) {
                throw createError(400, "Only a current batter can be dismissed");
            }

            if (nextWickets < 10) {
                if (
                    !delivery.nextStrikerId ||
                    !delivery.nextNonStrikerId ||
                    delivery.nextStrikerId === delivery.nextNonStrikerId
                ) {
                    throw createError(400, "Select two different batters for the next delivery");
                }

                const survivingBatter =
                    dismissedId === String(innings.current_striker_id)
                        ? String(innings.current_non_striker_id)
                        : String(innings.current_striker_id);
                const nextIds = [
                    delivery.nextStrikerId,
                    delivery.nextNonStrikerId
                ];
                const newBatterId = nextIds.find((id) => id !== survivingBatter);

                if (
                    !nextIds.includes(survivingBatter) ||
                    !newBatterId ||
                    newBatterId === dismissedId
                ) {
                    throw createError(400, "The next batters must include the survivor and a new batter");
                }

                const newBatter = players.get(newBatterId);
                if (
                    !newBatter ||
                    !newBatter.is_active ||
                    newBatter.team_id !== String(innings.batting_team_id)
                ) {
                    throw createError(400, "The incoming batter must be active and on the batting team");
                }

                const alreadyDismissed = await client.query(
                    `SELECT 1
                     FROM deliveries
                     WHERE innings_id = $1
                       AND dismissed_player_id = $2
                     LIMIT 1`,
                    [inningsId, newBatterId]
                );
                if (alreadyDismissed.rows.length > 0) {
                    throw createError(400, "A dismissed batter cannot return to the crease");
                }
            } else if (delivery.nextStrikerId || delivery.nextNonStrikerId) {
                throw createError(400, "No batters should be selected after the tenth wicket");
            }
        } else {
            if (delivery.dismissedPlayerId) {
                throw createError(400, "A dismissed player requires a wicket type");
            }
            if (
                !delivery.nextStrikerId ||
                !delivery.nextNonStrikerId ||
                delivery.nextStrikerId === delivery.nextNonStrikerId ||
                ![
                    String(innings.current_striker_id),
                    String(innings.current_non_striker_id)
                ].includes(delivery.nextStrikerId) ||
                ![
                    String(innings.current_striker_id),
                    String(innings.current_non_striker_id)
                ].includes(delivery.nextNonStrikerId)
            ) {
                throw createError(400, "Next batters must be the current batters in either order");
            }
        }

        const deliveryNumberResult = await client.query(
            `SELECT COALESCE(MAX(delivery_number), 0) + 1 AS next_number
             FROM deliveries
             WHERE innings_id = $1`,
            [inningsId]
        );
        const deliveryNumber = Number(deliveryNumberResult.rows[0].next_number);
        const legacyExtrasType =
            delivery.extras.wide > 0
                ? "wide"
                : delivery.extras.noBall > 0
                    ? "no_ball"
                    : delivery.extras.bye > 0
                        ? "bye"
                        : delivery.extras.legBye > 0
                            ? "leg_bye"
                            : delivery.extras.penalty > 0
                                ? "penalty"
                                : null;

        await client.query(
            `INSERT INTO deliveries (
                innings_id,
                delivery_number,
                striker_id,
                non_striker_id,
                bowler_id,
                batter_runs,
                is_boundary,
                extras_type,
                extras_runs,
                wide_runs,
                no_ball_runs,
                bye_runs,
                leg_bye_runs,
                penalty_runs,
                legal_ball,
                wicket_type,
                dismissed_player_id,
                next_striker_id,
                next_non_striker_id
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19
             )`,
            [
                inningsId,
                deliveryNumber,
                innings.current_striker_id,
                innings.current_non_striker_id,
                delivery.bowlerId,
                delivery.batterRuns,
                delivery.isBoundary,
                legacyExtrasType,
                extrasRuns,
                delivery.extras.wide,
                delivery.extras.noBall,
                delivery.extras.bye,
                delivery.extras.legBye,
                delivery.extras.penalty,
                legalBall,
                delivery.wicketType,
                delivery.dismissedPlayerId,
                delivery.nextStrikerId,
                delivery.nextNonStrikerId
            ]
        );

        const nextBowlerId =
            isCompleted || (legalBall && nextLegalBalls % 6 === 0)
                ? null
                : delivery.bowlerId;
        await client.query(
            `UPDATE innings
             SET total_runs = $1,
                 wickets = $2,
                 legal_balls = $3,
                 status = $4,
                 completed_at = CASE WHEN $4 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
                 current_striker_id = $5,
                 current_non_striker_id = $6,
                 current_bowler_id = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8`,
            [
                nextTotalRuns,
                nextWickets,
                nextLegalBalls,
                isCompleted ? "completed" : "live",
                isCompleted ? null : delivery.nextStrikerId,
                isCompleted ? null : delivery.nextNonStrikerId,
                nextBowlerId,
                inningsId
            ]
        );

        const reachedTarget =
            innings.target_runs !== null &&
            nextTotalRuns >= Number(innings.target_runs);
        if (reachedTarget || (isCompleted && Number(innings.innings_number) === 2)) {
            const winner = await getWinner(client, innings.match_id);
            await client.query(
                `UPDATE matches
                 SET status = 'completed',
                     winner_team_id = $1,
                     result_text = $2,
                     completed_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [winner.winnerTeamId, winner.text, innings.match_id]
            );
        }
    });

    const inningsResult = await pool.query(
        "SELECT match_id FROM innings WHERE id = $1",
        [inningsId]
    );
    return getMatchById(inningsResult.rows[0].match_id);
};

export const undoLatestDelivery = async (inningsId) => {
    await withTransaction(async (client) => {
        const inningsResult = await client.query(
            `SELECT i.*, m.overs_per_innings, m.status AS match_status
             FROM innings AS i
             JOIN matches AS m ON m.id = i.match_id
             WHERE i.id = $1
             FOR UPDATE OF i, m`,
            [inningsId]
        );
        const innings = inningsResult.rows[0];

        if (!innings) {
            throw createError(404, "Innings not found");
        }
        if (
            !["live", "completed"].includes(innings.match_status) ||
            innings.status === "scheduled"
        ) {
            throw createError(409, "Cannot undo a delivery in this innings state");
        }
        if (Number(innings.innings_number) === 1) {
            const secondInnings = await client.query(
                "SELECT 1 FROM innings WHERE match_id = $1 AND innings_number = 2",
                [innings.match_id]
            );
            if (secondInnings.rows.length > 0) {
                throw createError(409, "Cannot undo the first innings after the second innings has started");
            }
        }

        const latestResult = await client.query(
            `SELECT *
             FROM deliveries
             WHERE innings_id = $1
             ORDER BY delivery_number DESC
             LIMIT 1
             FOR UPDATE`,
            [inningsId]
        );
        const latest = latestResult.rows[0];

        if (!latest) {
            throw createError(404, "No delivery is available to undo");
        }

        await client.query("DELETE FROM deliveries WHERE id = $1", [latest.id]);

        const scoreResult = await client.query(
            `SELECT
                COALESCE(SUM(batter_runs + extras_runs), 0)::INTEGER AS total_runs,
                COUNT(*) FILTER (WHERE wicket_type IS NOT NULL)::SMALLINT AS wickets,
                COUNT(*) FILTER (WHERE legal_ball)::INTEGER AS legal_balls
             FROM deliveries
             WHERE innings_id = $1`,
            [inningsId]
        );
        const score = scoreResult.rows[0];
        const previousResult = await client.query(
            `SELECT *
             FROM deliveries
             WHERE innings_id = $1
             ORDER BY delivery_number DESC
             LIMIT 1`,
            [inningsId]
        );
        const previous = previousResult.rows[0];
        const hasBallsInCurrentOver = Number(score.legal_balls) % 6 !== 0;
        const strikerId = previous
            ? previous.next_striker_id || previous.striker_id
            : latest.striker_id;
        const nonStrikerId = previous
            ? previous.next_non_striker_id || previous.non_striker_id
            : latest.non_striker_id;
        const bowlerId = hasBallsInCurrentOver
            ? previous
                ? previous.bowler_id
                : latest.bowler_id
            : null;
        const remainsCompleted = isInningsComplete({
            legalBalls: Number(score.legal_balls),
            oversPerInnings: Number(innings.overs_per_innings),
            wickets: Number(score.wickets),
            totalRuns: Number(score.total_runs),
            targetRuns:
                innings.target_runs === null
                    ? null
                    : Number(innings.target_runs)
        });

        await client.query(
            `UPDATE innings
             SET total_runs = $1,
                 wickets = $2,
                 legal_balls = $3,
                 status = $4,
                 completed_at = NULL,
                 current_striker_id = $5,
                 current_non_striker_id = $6,
                 current_bowler_id = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8`,
            [
                score.total_runs,
                score.wickets,
                score.legal_balls,
                remainsCompleted ? "completed" : "live",
                remainsCompleted ? null : strikerId,
                remainsCompleted ? null : nonStrikerId,
                remainsCompleted ? null : bowlerId,
                inningsId
            ]
        );

        if (Number(innings.innings_number) === 2) {
            if (remainsCompleted) {
                const winner = await getWinner(client, innings.match_id);
                await client.query(
                    `UPDATE matches
                     SET status = 'completed',
                         winner_team_id = $1,
                         result_text = $2,
                         completed_at = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    [winner.winnerTeamId, winner.text, innings.match_id]
                );
            } else {
                await client.query(
                    `UPDATE matches
                     SET status = 'live',
                         winner_team_id = NULL,
                         result_text = NULL,
                         completed_at = NULL,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [innings.match_id]
                );
            }
        }
    });

    const inningsResult = await pool.query(
        "SELECT match_id FROM innings WHERE id = $1",
        [inningsId]
    );
    return getMatchById(inningsResult.rows[0].match_id);
};

export const completeInnings = async (inningsId) => {
    const matchId = await withTransaction(async (client) => {
        const inningsResult = await client.query(
            `SELECT i.*, m.status AS match_status
             FROM innings AS i
             JOIN matches AS m ON m.id = i.match_id
             WHERE i.id = $1
             FOR UPDATE OF i, m`,
            [inningsId]
        );
        const innings = inningsResult.rows[0];

        if (!innings) {
            throw createError(404, "Innings not found");
        }
        if (innings.status !== "live" || innings.match_status !== "live") {
            throw createError(409, "Only live innings can be completed");
        }

        await client.query(
            `UPDATE innings
             SET status = 'completed',
                 completed_at = CURRENT_TIMESTAMP,
                 current_striker_id = NULL,
                 current_non_striker_id = NULL,
                 current_bowler_id = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [inningsId]
        );

        if (Number(innings.innings_number) === 2) {
            const winner = await getWinner(client, innings.match_id);
            await client.query(
                `UPDATE matches
                 SET status = 'completed',
                     winner_team_id = $1,
                     result_text = $2,
                     completed_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [winner.winnerTeamId, winner.text, innings.match_id]
            );
        }

        return innings.match_id;
    });

    return getMatchById(matchId);
};

export const abandonMatch = async (matchId) => {
    await withTransaction(async (client) => {
        const matchResult = await client.query(
            `SELECT status
             FROM matches
             WHERE id = $1
             FOR UPDATE`,
            [matchId]
        );
        const match = matchResult.rows[0];

        if (!match) {
            throw createError(404, "Match not found");
        }
        if (["completed", "abandoned"].includes(match.status)) {
            throw createError(409, "Match is already finished");
        }

        await client.query(
            `UPDATE innings
             SET status = CASE WHEN status = 'live' THEN 'completed' ELSE status END,
                 completed_at = CASE WHEN status = 'live' THEN CURRENT_TIMESTAMP ELSE completed_at END,
                 current_striker_id = NULL,
                 current_non_striker_id = NULL,
                 current_bowler_id = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE match_id = $1`,
            [matchId]
        );
        await client.query(
            `UPDATE matches
             SET status = 'abandoned',
                 result_text = 'Match abandoned',
                 completed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [matchId]
        );
    });

    return getMatchById(matchId);
};
