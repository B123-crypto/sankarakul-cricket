import { readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import pool, { validateDatabaseConfig } from "./db.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(currentDirectory, "../migrations");
const migrationNamePattern = /^\d+_[a-z0-9_]+\.sql$/;
const migrationLockId = "781234567890123";

export const runMigrations = async () => {
    validateDatabaseConfig();
    const migrationFiles = (await readdir(migrationsDirectory))
        .filter((fileName) => migrationNamePattern.test(fileName))
        .sort((left, right) => {
            const leftVersion = Number(left.match(/^\d+/)[0]);
            const rightVersion = Number(right.match(/^\d+/)[0]);
            return leftVersion - rightVersion || left.localeCompare(right);
        });
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [migrationLockId]);
        await client.query(`
            CREATE TABLE IF NOT EXISTS app_schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const appliedResult = await client.query(
            "SELECT name FROM app_schema_migrations"
        );
        const appliedMigrations = new Set(
            appliedResult.rows.map((row) => row.name)
        );

        for (const fileName of migrationFiles) {
            if (appliedMigrations.has(fileName)) {
                continue;
            }

            const migrationSql = await readFile(
                path.join(migrationsDirectory, fileName),
                "utf8"
            );

            await client.query(migrationSql);
            await client.query(
                "INSERT INTO app_schema_migrations (name) VALUES ($1)",
                [fileName]
            );
            console.log(`Applied database migration: ${fileName}`);
        }

        await client.query("COMMIT");
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Database migration rollback failed:", rollbackError);
        }
        throw error;
    } finally {
        client.release();
    }
};

const isExecutedDirectly = process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isExecutedDirectly) {
    try {
        await runMigrations();
        console.log("Database migrations are up to date.");
    } catch (error) {
        console.error("Database migration failed:", error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}
