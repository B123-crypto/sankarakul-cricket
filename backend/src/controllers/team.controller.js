import {
    createPlayer,
    createTeam,
    getPlayersByTeam,
    getTeamById,
    getTeams,
    updatePlayer,
    updateTeam
} from "../services/team.service.js";
import {
    isValidDatabaseId
} from "../utils/ids.js";

const validRoles = ["batter", "bowler", "all_rounder", "wicket_keeper"];

const handleDatabaseError = (res, error, action) => {
    if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "A team or player with those details already exists"
        });
    }

    if (error.code === "23503") {
        return res.status(404).json({
            success: false,
            message: "Referenced team or player was not found"
        });
    }

    console.error(`${action} error:`, error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
};

export const listTeams = async (req, res) => {
    try {
        const teams = await getTeams();
        return res.status(200).json({ success: true, data: teams });
    } catch (error) {
        return handleDatabaseError(res, error, "List teams");
    }
};

export const getTeam = async (req, res) => {
    const { id } = req.params;

    if (!isValidDatabaseId(id)) {
        return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    try {
        const team = await getTeamById(id);

        if (!team) {
            return res.status(404).json({ success: false, message: "Team not found" });
        }

        return res.status(200).json({ success: true, data: team });
    } catch (error) {
        return handleDatabaseError(res, error, "Get team");
    }
};

export const listTeamPlayers = async (req, res) => {
    const { teamId } = req.params;

    if (!isValidDatabaseId(teamId)) {
        return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    try {
        const team = await getTeamById(teamId);

        if (!team) {
            return res.status(404).json({ success: false, message: "Team not found" });
        }

        const includeInactive =
            Boolean(req.admin) && req.query.includeInactive === "true";
        const players = await getPlayersByTeam(teamId, includeInactive);
        return res.status(200).json({ success: true, data: players });
    } catch (error) {
        return handleDatabaseError(res, error, "List team players");
    }
};

export const addTeam = async (req, res) => {
    const { name, shortName } = req.body || {};

    if (
        typeof name !== "string" ||
        typeof shortName !== "string" ||
        !name.trim() ||
        !shortName.trim() ||
        name.trim().length > 120 ||
        shortName.trim().length > 12
    ) {
        return res.status(400).json({
            success: false,
            message: "A team name (1-120 chars) and short name (1-12 chars) are required"
        });
    }

    try {
        const team = await createTeam(name.trim(), shortName.trim().toUpperCase());
        return res.status(201).json({ success: true, data: team });
    } catch (error) {
        return handleDatabaseError(res, error, "Create team");
    }
};

export const editTeam = async (req, res) => {
    const { id } = req.params;
    const { name, shortName } = req.body || {};

    if (!isValidDatabaseId(id)) {
        return res.status(400).json({ success: false, message: "Invalid team ID" });
    }

    if (
        (name === undefined && shortName === undefined) ||
        (name !== undefined &&
            (typeof name !== "string" || !name.trim() || name.trim().length > 120)) ||
        (shortName !== undefined &&
            (typeof shortName !== "string" ||
                !shortName.trim() ||
                shortName.trim().length > 12))
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid team name or short name"
        });
    }

    try {
        const team = await updateTeam(
            id,
            name === undefined ? null : name.trim(),
            shortName === undefined ? null : shortName.trim().toUpperCase()
        );

        if (!team) {
            return res.status(404).json({ success: false, message: "Team not found" });
        }

        return res.status(200).json({ success: true, data: team });
    } catch (error) {
        return handleDatabaseError(res, error, "Update team");
    }
};

export const addPlayer = async (req, res) => {
    const { teamId } = req.params;
    const { name, role, jerseyNumber } = req.body || {};
    const normalizedJerseyNumber = jerseyNumber === undefined ? null : jerseyNumber;

    if (
        !isValidDatabaseId(teamId) ||
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 120 ||
        !validRoles.includes(role) ||
        (normalizedJerseyNumber !== null &&
            (!Number.isInteger(normalizedJerseyNumber) ||
                normalizedJerseyNumber < 1 ||
                normalizedJerseyNumber > 999))
    ) {
        return res.status(400).json({
            success: false,
            message: "Valid team, player name, role, and optional jersey number are required"
        });
    }

    try {
        const team = await getTeamById(teamId);

        if (!team) {
            return res.status(404).json({ success: false, message: "Team not found" });
        }

        const player = await createPlayer(
            teamId,
            name.trim(),
            role,
            normalizedJerseyNumber
        );
        return res.status(201).json({ success: true, data: player });
    } catch (error) {
        return handleDatabaseError(res, error, "Create player");
    }
};

export const editPlayer = async (req, res) => {
    const { id } = req.params;
    const { name, role, jerseyNumber, isActive } = req.body || {};

    if (
        !isValidDatabaseId(id) ||
        (name === undefined &&
            role === undefined &&
            jerseyNumber === undefined &&
            isActive === undefined) ||
        (name !== undefined &&
            (typeof name !== "string" || !name.trim() || name.trim().length > 120)) ||
        (role !== undefined && !validRoles.includes(role)) ||
        (jerseyNumber !== undefined &&
            jerseyNumber !== null &&
            (!Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 999)) ||
        (isActive !== undefined && typeof isActive !== "boolean")
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide valid player fields to update"
        });
    }

    try {
        const player = await updatePlayer(
            id,
            name === undefined ? null : name.trim(),
            role === undefined ? null : role,
            {
                provided: jerseyNumber !== undefined,
                value: jerseyNumber === undefined ? null : jerseyNumber
            },
            isActive === undefined ? null : isActive
        );

        if (!player) {
            return res.status(404).json({ success: false, message: "Player not found" });
        }

        return res.status(200).json({ success: true, data: player });
    } catch (error) {
        return handleDatabaseError(res, error, "Update player");
    }
};
