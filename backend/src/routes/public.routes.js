import express from "express";

import {
    getTeam,
    listTeamPlayers,
    listTeams
} from "../controllers/team.controller.js";
import { getMatch, listMatches } from "../controllers/match.controller.js";

const router = express.Router();

router.get("/teams", listTeams);
router.get("/teams/:id", getTeam);
router.get("/teams/:teamId/players", listTeamPlayers);
router.get("/matches", listMatches);
router.get("/matches/:id", getMatch);

export default router;
