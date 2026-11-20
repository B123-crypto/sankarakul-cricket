
import jwt from "jsonwebtoken";
import { getAdminById } from "../services/admin.service.js";

export const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: "JWT configuration missing"
        });
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Access denied. Authentication token required."
        });
    }

    const token = authHeader.slice("Bearer ".length);
    let decoded;

    try {
        decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Authentication token expired."
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid authentication token."
        });
    }

    if (
        !decoded ||
        typeof decoded !== "object" ||
        !/^\d+$/.test(String(decoded.id))
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid authentication token."
        });
    }

    let admin;

    try {
        admin = await getAdminById(String(decoded.id));
    } catch (error) {
        console.error("Admin authentication lookup error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to verify admin account"
        });
    }

    if (!admin) {
        return res.status(401).json({
            success: false,
            message: "Admin account no longer exists."
        });
    }

    if (!admin.is_active) {
        return res.status(403).json({
            success: false,
            message: "Admin account is inactive."
        });
    }

    if (
        !Number.isInteger(decoded.authVersion) ||
        decoded.authVersion !== admin.auth_version
    ) {
        return res.status(401).json({
            success: false,
            message: "Authentication token was revoked. Log in again."
        });
    }

    if (!["admin", "super_admin"].includes(admin.role)) {
        return res.status(403).json({
            success: false,
            message: "Admin access required."
        });
    }

    req.admin = {
        id: admin.id,
        email: admin.email,
        role: admin.role
    };

    next();
};


export const authorizeSuperAdmin = (req, res, next) => {
    if (req.admin?.role !== "super_admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Super admin permission required."
        });
    }

    next();
};