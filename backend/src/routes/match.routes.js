import express from "express";

import {
    beginMatch,
    beginSecondInnings,
    cancelMatch,
    createScheduledMatch,
    editScheduledMatch,
    finishInnings,
    recordDelivery,
    reverseLatestDelivery
} from "../controllers/match.controller.js";
import { authenticateAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/matches", authenticateAdmin, createScheduledMatch);
router.patch("/matches/:id", authenticateAdmin, editScheduledMatch);
router.post("/matches/:id/start", authenticateAdmin, beginMatch);
router.post("/matches/:id/innings/2/start", authenticateAdmin, beginSecondInnings);
router.patch("/matches/:id/abandon", authenticateAdmin, cancelMatch);
router.post("/innings/:inningsId/deliveries", authenticateAdmin, recordDelivery);
router.delete(
    "/innings/:inningsId/deliveries/latest",
    authenticateAdmin,
    reverseLatestDelivery
);
router.post("/innings/:inningsId/complete", authenticateAdmin, finishInnings);

export default router;
