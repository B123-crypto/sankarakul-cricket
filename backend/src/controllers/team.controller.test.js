import assert from "node:assert/strict";
import { test } from "node:test";

import { editTeam } from "./team.controller.js";

const createResponse = () => ({
    statusCode: null,
    body: null,
    status(statusCode) {
        this.statusCode = statusCode;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test("team updates reject invalid IDs and missing fields", async () => {
    const invalidIdResponse = createResponse();
    await editTeam(
        { params: { id: "invalid" }, body: undefined },
        invalidIdResponse
    );
    assert.equal(invalidIdResponse.statusCode, 400);

    const missingFieldsResponse = createResponse();
    await editTeam(
        { params: { id: "1" }, body: undefined },
        missingFieldsResponse
    );
    assert.equal(missingFieldsResponse.statusCode, 400);
});
