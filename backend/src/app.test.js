import assert from "node:assert/strict";
import { test } from "node:test";

process.env.JWT_SECRET = "test-jwt-secret-that-is-long-enough";

const { default: app } = await import("./app.js");

test("API exposes health, JSON errors, and read-only public access", async (t) => {
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const [health, missingRoute, protectedWrite, invalidJson] = await Promise.all([
        fetch(`${baseUrl}/api/health`),
        fetch(`${baseUrl}/not-a-route`),
        fetch(`${baseUrl}/api/admin/matches`, { method: "POST" }),
        fetch(`${baseUrl}/api/admin/matches`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{"
        })
    ]);

    assert.equal(health.status, 200);
    assert.equal(missingRoute.status, 404);
    assert.deepEqual(await missingRoute.json(), {
        success: false,
        message: "Route not found"
    });
    assert.equal(protectedWrite.status, 401);
    assert.equal(invalidJson.status, 400);
    assert.deepEqual(await invalidJson.json(), {
        success: false,
        message: "Request body must contain valid JSON"
    });
});
