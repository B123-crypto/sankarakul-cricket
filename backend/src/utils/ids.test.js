import assert from "node:assert/strict";
import test from "node:test";

import { isValidDatabaseId, normalizeDatabaseId } from "./ids.js";

test("database IDs accept safe positive values within PostgreSQL bigint range", () => {
    assert.equal(isValidDatabaseId("1"), true);
    assert.equal(isValidDatabaseId(42), true);
    assert.equal(isValidDatabaseId("9223372036854775807"), true);
});

test("database IDs reject zero, malformed values, and out-of-range numbers", () => {
    assert.equal(isValidDatabaseId("0"), false);
    assert.equal(isValidDatabaseId("-1"), false);
    assert.equal(isValidDatabaseId("1.5"), false);
    assert.equal(isValidDatabaseId("9223372036854775808"), false);
    assert.equal(isValidDatabaseId(Number.MAX_SAFE_INTEGER + 1), false);
});

test("database ID normalization removes leading zeroes", () => {
    assert.equal(normalizeDatabaseId("00042"), "42");
    assert.equal(normalizeDatabaseId(42), "42");
});
