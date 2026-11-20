import {
    abandonMatch,
    addDelivery,
    completeInnings,
    createMatch,
    getMatchById,
    getMatches,
    startMatch,
    startSecondInnings,
    undoLatestDelivery,
    updateScheduledMatch
} from "../services/match.service.js";
import {
    isValidDatabaseId,
    normalizeDatabaseId
} from "../utils/ids.js";
import { getDefaultBowlerOverLimit } from "../services/cricket.rules.js";

const validFormats = ["CUSTOM", "T10", "T20", "ODI"];
const extrasKeys = ["wide", "noBall", "bye", "legBye", "penalty"];
const validWickets = [
    "bowled",
    "caught",
    "lbw",
    "run_out",
    "stumped",
    "hit_wicket",
    "obstructing_field",
    "hit_ball_twice"
];
const respondWithError = (res, error, action) => {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "23503") {
        return res.status(400).json({
            success: false,
            message: "Referenced team, player, or match was not found"
        });
    }

    if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "This operation conflicts with existing match data"
        });
    }

    if (error.code === "23514" || error.code === "22P02") {
        return res.status(400).json({
            success: false,
            message: "The supplied match data is invalid"
        });
    }

    console.error(`${action} error:`, error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};

const emitMatchUpdate = (req, match) => {
    const io = req.app.get("io");
    if (!io || !match) {
        return;
    }

    io.to(`match:${match.id}`).emit("match:update", match);
    io.emit("match:list:update", {
        id: match.id,
        status: match.status,
        resultText: match.result_text
    });
};

const validateScheduledAt = (value) => {
    if (value === undefined || value === null || value === "") {
        return { valid: true, value: null };
    }

    if (typeof value !== "string") {
        return { valid: false };
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return { valid: false };
    }

    return { valid: true, value: date.toISOString() };
};

export const listMatches = async (req, res) => {
    const status = req.query.status || null;

    if (
        status !== null &&
        !["scheduled", "live", "completed", "abandoned"].includes(status)
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid match status filter"
        });
    }

    try {
        const matches = await getMatches(status);
        return res.status(200).json({ success: true, data: matches });
    } catch (error) {
        return respondWithError(res, error, "List matches");
    }
};

export const getMatch = async (req, res) => {
    const { id } = req.params;

    if (!isValidDatabaseId(id)) {
        return res.status(400).json({ success: false, message: "Invalid match ID" });
    }

    const requestedLimit = req.query.deliveryLimit === undefined
        ? 200
        : Number(req.query.deliveryLimit);

    if (
        !Number.isInteger(requestedLimit) ||
        requestedLimit < 1 ||
        requestedLimit > 500
    ) {
        return res.status(400).json({
            success: false,
            message: "deliveryLimit must be an integer from 1 to 500"
        });
    }

    try {
        const match = await getMatchById(id, requestedLimit);

        if (!match) {
            return res.status(404).json({ success: false, message: "Match not found" });
        }

        return res.status(200).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Get match");
    }
};

export const createScheduledMatch = async (req, res) => {
    const body = req.body || {};
    const {
        homeTeamId,
        awayTeamId,
        format = "CUSTOM",
        oversPerInnings,
        maxOversPerBowler,
        venue
    } = body;
    const scheduledAt = validateScheduledAt(body.scheduledAt);
    const bowlerOverLimit = maxOversPerBowler === undefined
        ? Number.isInteger(oversPerInnings)
            ? getDefaultBowlerOverLimit(oversPerInnings)
            : null
        : maxOversPerBowler;

    if (
        !isValidDatabaseId(homeTeamId) ||
        !isValidDatabaseId(awayTeamId) ||
        String(homeTeamId) === String(awayTeamId) ||
        !validFormats.includes(format) ||
        !Number.isInteger(oversPerInnings) ||
        oversPerInnings < 1 ||
        oversPerInnings > 100 ||
        !Number.isInteger(bowlerOverLimit) ||
        bowlerOverLimit < 1 ||
        bowlerOverLimit > oversPerInnings ||
        (venue !== undefined &&
            venue !== null &&
            (typeof venue !== "string" || venue.trim().length > 200)) ||
        !scheduledAt.valid
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide two different teams, 1-100 overs, and valid optional format, bowler limit, venue, and schedule"
        });
    }

    try {
        const match = await createMatch({
            homeTeamId: normalizeDatabaseId(homeTeamId),
            awayTeamId: normalizeDatabaseId(awayTeamId),
            format,
            oversPerInnings,
            maxOversPerBowler: bowlerOverLimit,
            venue: venue ? venue.trim() : null,
            scheduledAt: scheduledAt.value
        });
        emitMatchUpdate(req, match);
        return res.status(201).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Create match");
    }
};

export const editScheduledMatch = async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const { format, oversPerInnings, venue } = body;
    const maxOversPerBowler = body.maxOversPerBowler === undefined
        ? oversPerInnings === undefined
            ? null
            : getDefaultBowlerOverLimit(oversPerInnings)
        : body.maxOversPerBowler;
    const scheduledAt = validateScheduledAt(body.scheduledAt);

    if (!isValidDatabaseId(id)) {
        return res.status(400).json({ success: false, message: "Invalid match ID" });
    }

    if (
        (format === undefined &&
            oversPerInnings === undefined &&
            body.maxOversPerBowler === undefined &&
            venue === undefined &&
            body.scheduledAt === undefined) ||
        (format !== undefined && !validFormats.includes(format)) ||
        (oversPerInnings !== undefined &&
            (!Number.isInteger(oversPerInnings) ||
                oversPerInnings < 1 ||
                oversPerInnings > 100)) ||
        (maxOversPerBowler !== null &&
            (!Number.isInteger(maxOversPerBowler) ||
                maxOversPerBowler < 1 ||
                (oversPerInnings !== undefined &&
                    maxOversPerBowler > oversPerInnings))) ||
        (venue !== undefined &&
            venue !== null &&
            (typeof venue !== "string" || venue.trim().length > 200)) ||
        !scheduledAt.valid
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide valid scheduled match fields to update"
        });
    }

    try {
        const match = await updateScheduledMatch(id, {
            format: format === undefined ? null : format,
            oversPerInnings:
                oversPerInnings === undefined ? null : oversPerInnings,
            maxOversPerBowler,
            venue: {
                provided: venue !== undefined,
                value: venue === undefined ? null : venue ? venue.trim() : null
            },
            scheduledAt: {
                provided: body.scheduledAt !== undefined,
                value: scheduledAt.value
            }
        });

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Scheduled match not found"
            });
        }

        emitMatchUpdate(req, match);
        return res.status(200).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Update match");
    }
};

export const beginMatch = async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};

    if (
        !isValidDatabaseId(id) ||
        !isValidDatabaseId(body.battingFirstTeamId) ||
        !isValidDatabaseId(body.strikerId) ||
        !isValidDatabaseId(body.nonStrikerId) ||
        !isValidDatabaseId(body.bowlerId)
    ) {
        return res.status(400).json({
            success: false,
            message: "Match ID, batting first team, two openers, and opening bowler are required"
        });
    }

    try {
        const match = await startMatch(id, {
            battingTeamId: normalizeDatabaseId(body.battingFirstTeamId),
            strikerId: normalizeDatabaseId(body.strikerId),
            nonStrikerId: normalizeDatabaseId(body.nonStrikerId),
            bowlerId: normalizeDatabaseId(body.bowlerId)
        });
        emitMatchUpdate(req, match);
        return res.status(200).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Start match");
    }
};

export const beginSecondInnings = async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};

    if (
        !isValidDatabaseId(id) ||
        !isValidDatabaseId(body.strikerId) ||
        !isValidDatabaseId(body.nonStrikerId) ||
        !isValidDatabaseId(body.bowlerId)
    ) {
        return res.status(400).json({
            success: false,
            message: "Match ID, two openers, and opening bowler are required"
        });
    }

    try {
        const match = await startSecondInnings(id, {
            strikerId: normalizeDatabaseId(body.strikerId),
            nonStrikerId: normalizeDatabaseId(body.nonStrikerId),
            bowlerId: normalizeDatabaseId(body.bowlerId)
        });
        emitMatchUpdate(req, match);
        return res.status(200).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Start second innings");
    }
};

export const recordDelivery = async (req, res) => {
    const { inningsId } = req.params;
    const body = req.body || {};
    const batterRuns = body.batterRuns === undefined ? 0 : body.batterRuns;
    const isBoundary = body.isBoundary === undefined ? false : body.isBoundary;
    const rawExtras = body.extras === undefined ? {} : body.extras;
    const extras =
        rawExtras && typeof rawExtras === "object" && !Array.isArray(rawExtras)
            ? Object.fromEntries(
                extrasKeys.map((key) => [
                    key,
                    rawExtras[key] === undefined ? 0 : rawExtras[key]
                ])
            )
            : null;
    const wicketType = body.wicketType === undefined ? null : body.wicketType;
    const dismissedPlayerId =
        body.dismissedPlayerId === undefined || body.dismissedPlayerId === null
            ? null
            : body.dismissedPlayerId;
    const nextStrikerId =
        body.nextStrikerId === undefined || body.nextStrikerId === null
            ? null
            : body.nextStrikerId;
    const nextNonStrikerId =
        body.nextNonStrikerId === undefined || body.nextNonStrikerId === null
            ? null
            : body.nextNonStrikerId;
    const totalExtras = extras
        ? Object.values(extras).reduce((total, runs) => total + runs, 0)
        : NaN;

    if (
        !isValidDatabaseId(inningsId) ||
        !isValidDatabaseId(body.bowlerId) ||
        !Number.isInteger(batterRuns) ||
        batterRuns < 0 ||
        batterRuns > 100 ||
        typeof isBoundary !== "boolean" ||
        (isBoundary && ![4, 6].includes(batterRuns)) ||
        !extras ||
        Object.keys(rawExtras).some((key) => !extrasKeys.includes(key)) ||
        Object.values(extras).some(
            (runs) => !Number.isInteger(runs) || runs < 0 || runs > 100
        ) ||
        totalExtras > 100 ||
        (extras.wide > 0 && extras.noBall > 0) ||
        (extras.bye > 0 && extras.legBye > 0) ||
        (extras.wide > 0 && (extras.bye > 0 || extras.legBye > 0)) ||
        (batterRuns > 0 &&
            (extras.wide > 0 || extras.bye > 0 || extras.legBye > 0)) ||
        (wicketType !== null && !validWickets.includes(wicketType)) ||
        (dismissedPlayerId !== null && !isValidDatabaseId(dismissedPlayerId)) ||
        (nextStrikerId !== null && !isValidDatabaseId(nextStrikerId)) ||
        (nextNonStrikerId !== null && !isValidDatabaseId(nextNonStrikerId)) ||
        (wicketType === null && dismissedPlayerId !== null) ||
        (wicketType !== null && !isValidDatabaseId(dismissedPlayerId)) ||
        (nextStrikerId === null) !== (nextNonStrikerId === null) ||
        (extras.noBall > 0 &&
            wicketType !== null &&
            !["run_out", "obstructing_field", "hit_ball_twice"].includes(wicketType)) ||
        (extras.wide > 0 &&
            wicketType !== null &&
            !["run_out", "stumped", "hit_wicket", "obstructing_field"].includes(wicketType))
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid delivery data"
        });
    }

    try {
        const match = await addDelivery(normalizeDatabaseId(inningsId), {
            bowlerId: normalizeDatabaseId(body.bowlerId),
            batterRuns,
            isBoundary,
            extras,
            wicketType,
            dismissedPlayerId:
                dismissedPlayerId === null
                    ? null
                    : normalizeDatabaseId(dismissedPlayerId),
            nextStrikerId:
                nextStrikerId === null ? null : normalizeDatabaseId(nextStrikerId),
            nextNonStrikerId:
                nextNonStrikerId === null
                    ? null
                    : normalizeDatabaseId(nextNonStrikerId)
        });

        emitMatchUpdate(req, match);
        return res.status(201).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Record delivery");
    }
};

export const reverseLatestDelivery = async (req, res) => {
    const { inningsId } = req.params;

    if (!isValidDatabaseId(inningsId)) {
        return res.status(400).json({ success: false, message: "Invalid innings ID" });
    }

    try {
        const match = await undoLatestDelivery(normalizeDatabaseId(inningsId));
        emitMatchUpdate(req, match);
        return res.status(200).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Undo delivery");
    }
};

export const finishInnings = async (req, res) => {
    const { inningsId } = req.params;

    if (!isValidDatabaseId(inningsId)) {
        return res.status(400).json({ success: false, message: "Invalid innings ID" });
    }

    try {
        const match = await completeInnings(normalizeDatabaseId(inningsId));
        emitMatchUpdate(req, match);
        return res.status(200).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Complete innings");
    }
};

export const cancelMatch = async (req, res) => {
    const { id } = req.params;

    if (!isValidDatabaseId(id)) {
        return res.status(400).json({ success: false, message: "Invalid match ID" });
    }

    try {
        const match = await abandonMatch(normalizeDatabaseId(id));
        emitMatchUpdate(req, match);
        return res.status(200).json({ success: true, data: match });
    } catch (error) {
        return respondWithError(res, error, "Abandon match");
    }
};

