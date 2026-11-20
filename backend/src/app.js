
import express from "express";
import cors from "cors";
import helmet from "helmet";

import matchRoutes from "./routes/match.routes.js";
import publicRoutes from "./routes/public.routes.js";
import teamRoutes from "./routes/team.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors());

// Body Parser Middleware
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));

// Root API
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Cricket Live Score API is running!"
    });
});

// Health Check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend is healthy"
    });
});

app.use("/api", publicRoutes);
app.use("/api/admin", matchRoutes);
app.use("/api/admin", teamRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "Request body must contain valid JSON"
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "Request body is too large"
        });
    }

    console.error("Unhandled API error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

export default app;
