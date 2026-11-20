
import { timingSafeEqual } from "crypto";

export const verifyAdminSetupSecret = (req, res, next) => {
    const setupSecret = req.headers["x-admin-setup-secret"];

    if (!process.env.ADMIN_SETUP_SECRET) {
        return res.status(500).json({
            success: false,
            message: "Admin setup is not configured"
        });
    }

    const providedSecret = typeof setupSecret === "string"
        ? Buffer.from(setupSecret)
        : Buffer.alloc(0);
    const expectedSecret = Buffer.from(process.env.ADMIN_SETUP_SECRET);
    const secretMatches =
        providedSecret.length === expectedSecret.length &&
        timingSafeEqual(providedSecret, expectedSecret);

    if (!secretMatches) {
        return res.status(403).json({
            success: false,
            message: "Forbidden: Invalid admin setup secret"
        });
    }

    next();
};
