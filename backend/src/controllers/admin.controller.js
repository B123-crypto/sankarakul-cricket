
import jwt from "jsonwebtoken";

import {
    createAdmin,
    findAdminByEmail,
    verifyAdminPassword,
    getAllAdmins,
    getAdminById,
    changeAdminPassword,
    updateAdmin,
    updateAdminStatus
} from "../services/admin.service.js";


// ======================================
// ADMIN REGISTRATION
// ======================================

export const registerAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        const passwordBytes = Buffer.byteLength(password, "utf8");
        if (passwordBytes < 8 || passwordBytes > 72) {
            return res.status(400).json({
                success: false,
                message: "Password must contain 8-72 UTF-8 bytes"
            });
        }

        const admin = await createAdmin(
            name.trim(),
            email.trim().toLowerCase(),
            password
        );

        return res.status(201).json({
            success: true,
            message: "Admin registered successfully",
            data: admin
        });

    } catch (error) {
        console.error("Admin Registration Error:", error);

        if (
            error.message === "An active admin account already exists" ||
            error.constraint === "admins_one_active_admin_idx"
        ) {
            return res.status(409).json({
                success: false,
                message: "An active admin account already exists"
            });
        }

        if (error.message === "Admin email already exists" || error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Admin email already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ======================================
// ADMIN LOGIN
// ======================================

export const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const admin = await findAdminByEmail(
            email.trim().toLowerCase()
        );

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!admin.is_active) {
            return res.status(403).json({
                success: false,
                message: "Admin account is inactive"
            });
        }

        const isPasswordValid = await verifyAdminPassword(
            password,
            admin.password_hash
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        // Generate JWT with actual database role
        const token = jwt.sign(
            {
                id: admin.id,
                email: admin.email,
                role: admin.role,
                authVersion: admin.auth_version
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Admin login successful",
            data: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            },
            token
        });

    } catch (error) {
        console.error("Admin Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const changeOwnPassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        Buffer.byteLength(newPassword, "utf8") < 8 ||
        Buffer.byteLength(currentPassword, "utf8") > 72 ||
        Buffer.byteLength(newPassword, "utf8") > 72
    ) {
        return res.status(400).json({
            success: false,
            message: "Current password and a new password of 8-72 UTF-8 bytes are required"
        });
    }

    try {
        const result = await changeAdminPassword(
            req.admin.id,
            currentPassword,
            newPassword
        );

        if (result === "not_found") {
            return res.status(404).json({
                success: false,
                message: "Admin account not found"
            });
        }

        if (result === "invalid_password") {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Password updated. Log in again with the new password."
        });
    } catch (error) {
        console.error("Change admin password error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ======================================
// GET ALL ADMINS
// ======================================

export const getAdmins = async (req, res) => {
    try {
        const admins = await getAllAdmins();

        return res.status(200).json({
            success: true,
            message: "Admins fetched successfully",
            total: admins.length,
            admins
        });

    } catch (error) {
        console.error("Get admins error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ======================================
// GET ADMIN BY ID
// ======================================

export const getAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^\d+$/.test(id) || BigInt(id) <= 0n) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin ID"
            });
        }

        const admin = await getAdminById(id);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Admin fetched successfully",
            admin
        });

    } catch (error) {
        console.error("Get admin error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ======================================
// UPDATE ADMIN
// ======================================

export const updateAdminDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role } = req.body || {};

        if (!/^\d+$/.test(id) || BigInt(id) <= 0n) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin ID"
            });
        }

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof role !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid name, email and role are required"
            });
        }

        if (!["admin", "super_admin"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin role"
            });
        }

        const updatedAdmin = await updateAdmin(
            id,
            name.trim(),
            email.trim().toLowerCase(),
            role
        );

        if (!updatedAdmin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Admin updated successfully",
            admin: updatedAdmin
        });

    } catch (error) {
        console.error("Update admin error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ======================================
// ACTIVATE / DEACTIVATE ADMIN
// ======================================

export const changeAdminStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body || {};

        if (!/^\d+$/.test(id) || BigInt(id) <= 0n) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin ID"
            });
        }

        if (typeof is_active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_active must be true or false"
            });
        }

        // Prevent changing your own account status
        if (String(req.admin.id) === id) {
            return res.status(400).json({
                success: false,
                message: "You cannot change your own account status"
            });
        }

        const updatedAdmin = await updateAdminStatus(
            id,
            is_active
        );

        if (!updatedAdmin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: is_active
                ? "Admin activated successfully"
                : "Admin deactivated successfully",
            admin: updatedAdmin
        });

    } catch (error) {
        console.error("Change admin status error:", error);

        if (error.constraint === "admins_one_active_admin_idx") {
            return res.status(409).json({
                success: false,
                message: "An active admin account already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};