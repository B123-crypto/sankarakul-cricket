
import pool from "../config/db.js";
import bcrypt from "bcryptjs";

// ======================================
// CREATE ADMIN
// ======================================

export const createAdmin = async (name, email, password) => {
    const existingAdmin = await pool.query(
        "SELECT id FROM admins WHERE email = $1",
        [email]
    );

    if (existingAdmin.rows.length > 0) {
        throw new Error("Admin email already exists");
    }

    const activeAdmin = await pool.query(
        `SELECT id
         FROM admins
         WHERE is_active = TRUE
           AND role IN ('admin', 'super_admin')
         LIMIT 1`
    );

    if (activeAdmin.rows.length > 0) {
        throw new Error("An active admin account already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
        `INSERT INTO admins (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, role, is_active, created_at`,
        [name, email, hashedPassword]
    );

    return result.rows[0];
};


// ======================================
// FIND ADMIN BY EMAIL
// ======================================

export const findAdminByEmail = async (email) => {
    const result = await pool.query(
        `SELECT
            id,
            name,
            email,
            password_hash,
            is_active,
           role,
           auth_version
         FROM admins
         WHERE email = $1`,
        [email]
    );

    return result.rows[0];
};


// ======================================
// VERIFY ADMIN PASSWORD
// ======================================

export const verifyAdminPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};


// ======================================
// GET ALL ADMINS
// ======================================

export const getAllAdmins = async () => {
    const result = await pool.query(
        `SELECT
            id,
            name,
            email,
            role,
            is_active,
            created_at,
            updated_at
         FROM admins
         ORDER BY id DESC`
    );

    return result.rows;
};


// ======================================
// GET ADMIN BY ID
// ======================================

export const getAdminById = async (id) => {
    const result = await pool.query(
        `SELECT
            id,
            name,
            email,
            role,
            is_active,
            auth_version,
            created_at,
            updated_at
         FROM admins
         WHERE id = $1`,
        [id]
    );

    return result.rows[0];
};

export const changeAdminPassword = async (id, currentPassword, newPassword) => {
    const adminResult = await pool.query(
        `SELECT password_hash
         FROM admins
         WHERE id = $1
           AND is_active = TRUE`,
        [id]
    );
    const admin = adminResult.rows[0];

    if (!admin) {
        return "not_found";
    }

    if (!(await bcrypt.compare(currentPassword, admin.password_hash))) {
        return "invalid_password";
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updateResult = await pool.query(
        `UPDATE admins
         SET password_hash = $1,
             auth_version = auth_version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND password_hash = $3
           AND is_active = TRUE`,
        [passwordHash, id, admin.password_hash]
    );

    return updateResult.rowCount === 1 ? "updated" : "invalid_password";
};


// ======================================
// UPDATE ADMIN
// ======================================

export const updateAdmin = async (id, name, email, role) => {
    const result = await pool.query(
        `UPDATE admins
         SET
            name = $1,
            email = $2,
            role = $3,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING
            id,
            name,
            email,
            role,
            is_active,
            created_at,
            updated_at`,
        [name, email, role, id]
    );

    return result.rows[0];
};

// ======================================
// UPDATE ADMIN STATUS
// ======================================

export const updateAdminStatus = async (id, isActive) => {
    const result = await pool.query(
        `UPDATE admins
         SET
            is_active = $1,
            auth_version = auth_version + 1,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING
            id,
            name,
            email,
            role,
            is_active,
            updated_at`,
        [isActive, id]
    );

    return result.rows[0];
};