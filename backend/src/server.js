
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { Server } from "socket.io";

import app from "./app.js";
import pool, { query, testDatabaseConnection } from "./config/db.js";
import {
    isValidDatabaseId,
    normalizeDatabaseId
} from "./utils/ids.js";

const PORT = process.env.PORT === undefined ? 5000 : Number(process.env.PORT);

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});

io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("match:join", async (matchId, acknowledge) => {
        const respond = typeof acknowledge === "function" ? acknowledge : () => {};

        if (!isValidDatabaseId(matchId)) {
            respond({ success: false, message: "Invalid match ID" });
            return;
        }

        try {
            const normalizedMatchId = normalizeDatabaseId(matchId);
            const result = await query(
                "SELECT 1 FROM matches WHERE id = $1",
                [normalizedMatchId]
            );
            if (result.rows.length === 0) {
                respond({ success: false, message: "Match not found" });
                return;
            }

            socket.join(`match:${normalizedMatchId}`);
            respond({ success: true });
        } catch (error) {
            console.error("Socket match subscription error:", error);
            respond({ success: false, message: "Unable to join match updates" });
        }
    });

    socket.on("match:leave", (matchId) => {
        if (isValidDatabaseId(matchId)) {
            socket.leave(`match:${normalizeDatabaseId(matchId)}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

app.set("io", io);

let shutdownPromise;

const shutdown = (signal) => {
    if (shutdownPromise) {
        return shutdownPromise;
    }

    console.log(`Received ${signal}; shutting down.`);
    shutdownPromise = new Promise((resolve, reject) => {
        io.close(async () => {
            try {
                await pool.end();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });

    return shutdownPromise;
};

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
        shutdown(signal).catch((error) => {
            console.error("Graceful shutdown failed:", error);
            process.exitCode = 1;
        });
    });
}

const startServer = async () => {
    try {
        if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
            throw new Error("PORT must be an integer between 1 and 65535");
        }
        if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
            throw new Error("JWT_SECRET must be configured with at least 32 bytes");
        }
        if (
            !process.env.ADMIN_SETUP_SECRET ||
            Buffer.byteLength(process.env.ADMIN_SETUP_SECRET) < 32
        ) {
            throw new Error(
                "ADMIN_SETUP_SECRET must be configured with at least 32 bytes"
            );
        }

        await testDatabaseConnection();

        await new Promise((resolve, reject) => {
            const onError = (error) => reject(error);
            httpServer.once("error", onError);
            httpServer.listen(PORT, () => {
                httpServer.off("error", onError);
                resolve();
            });
        });

        console.log("Cricket Live Score Backend");
        console.log(`Server running on port ${PORT}`);
        console.log(`URL: http://localhost:${PORT}`);

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
