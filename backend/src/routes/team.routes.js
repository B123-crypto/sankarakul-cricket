import express from "express";

import {
    addPlayer,
    addTeam,
    editPlayer,
    editTeam,
    listTeamPlayers
} from "../controllers/team.controller.js";
import { authenticateAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/teams", authenticateAdmin, addTeam);
router.patch("/teams/:id", authenticateAdmin, editTeam);
router.get("/teams/:teamId/players", authenticateAdmin, listTeamPlayers);
router.post("/teams/:teamId/players", authenticateAdmin, addPlayer);
router.patch("/players/:id", authenticateAdmin, editPlayer);

export default router;
