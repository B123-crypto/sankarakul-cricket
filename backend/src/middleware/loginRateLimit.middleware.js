const windowMs = 15 * 60 * 1000;
const maxAttempts = 10;
const attemptsByIp = new Map();

export const limitAdminLoginAttempts = (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    let attempts = attemptsByIp.get(ip);

    if (!attempts || attempts.resetAt <= now) {
        attempts = { count: 0, resetAt: now + windowMs };
        attemptsByIp.set(ip, attempts);
    }

    if (attempts.count >= maxAttempts) {
        res.set("Retry-After", String(Math.ceil((attempts.resetAt - now) / 1000)));
        return res.status(429).json({
            success: false,
            message: "Too many login attempts. Try again later."
        });
    }

    attempts.count += 1;

    if (attemptsByIp.size > 10000) {
        for (const [storedIp, storedAttempts] of attemptsByIp) {
            if (storedAttempts.resetAt <= now) {
                attemptsByIp.delete(storedIp);
            }
        }
    }

    next();
};
