
import express from "express";

import {
    registerAdmin,
    loginAdmin,
    getAdmins,
    getAdmin,
    updateAdminDetails,
    changeAdminStatus,
    changeOwnPassword
} from "../controllers/admin.controller.js";

import {
    authenticateAdmin,
    authorizeSuperAdmin
} from "../middleware/auth.middleware.js";

import {
    verifyAdminSetupSecret
} from "../middleware/adminSetup.middleware.js";
import { limitAdminLoginAttempts } from "../middleware/loginRateLimit.middleware.js";


const router = express.Router();


// ======================================
// ADMIN REGISTRATION
// ======================================

router.post(
    "/register",
    verifyAdminSetupSecret,
    registerAdmin
);


// ======================================
// ADMIN LOGIN
// ======================================

router.post(
    "/login",
    limitAdminLoginAttempts,
    loginAdmin
);


// ======================================
// ADMIN DASHBOARD
// ======================================

router.get(
    "/dashboard",
    authenticateAdmin,
    (req, res) => {
        return res.status(200).json({
            success: true,
            message: "Welcome to Admin Dashboard",
            admin: req.admin
        });
    }
);

router.patch(
    "/password",
    authenticateAdmin,
    changeOwnPassword
);


// ======================================
// GET ALL ADMINS
// ======================================

router.get(
    "/",
    authenticateAdmin,
    authorizeSuperAdmin,
    getAdmins
);


// ======================================
// GET ADMIN BY ID
// ======================================

router.get(
    "/:id",
    authenticateAdmin,
    authorizeSuperAdmin,
    getAdmin
);


// ======================================
// UPDATE ADMIN
// ======================================

router.put(
    "/:id",
    authenticateAdmin,
    authorizeSuperAdmin,
    updateAdminDetails
);

// Activate / Deactivate Admin
router.patch(
    "/:id/status",
    authenticateAdmin,
    authorizeSuperAdmin,
    changeAdminStatus
);


export default router;
