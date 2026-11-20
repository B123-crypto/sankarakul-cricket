
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const databasePort = process.env.DB_PORT === undefined
    ? 5432
    : Number(process.env.DB_PORT);

const pool = new Pool({
    host: process.env.DB_HOST,
    port: databasePort,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized:
                process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
        }
        : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on("connect", () => {
    console.log("PostgreSQL client connected");
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL error:", error);
});

export const query = (text, params) => {
    return pool.query(text, params);
};

export const validateDatabaseConfig = () => {
    const requiredVariables = ["DB_HOST", "DB_NAME", "DB_USER"];
    const missingVariables = requiredVariables.filter(
        (variable) => !process.env[variable]
    );

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing required database configuration: ${missingVariables.join(", ")}`
        );
    }

    if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) {
        throw new Error("DB_PORT must be an integer between 1 and 65535");
    }
};

export const testDatabaseConnection = async () => {
    try {
        validateDatabaseConfig();
        const result = await pool.query(
            "SELECT NOW() AS current_time"
        );

        console.log("PostgreSQL connected successfully!");
        console.log("Database time:", result.rows[0].current_time);

    } catch (error) {
        console.error("Database connection failed:", error.message);
        throw error;
    }
};

export default pool;
