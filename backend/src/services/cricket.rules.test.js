import assert from "node:assert/strict";
import test from "node:test";

import {
    getDefaultBowlerOverLimit,
    getDeliveryTotals,
    isInningsComplete
} from "./cricket.rules.js";

test("wide and no-ball deliveries do not count as legal balls", () => {
    assert.deepEqual(
        getDeliveryTotals({
            batterRuns: 0,
            extras: { wide: 1, noBall: 0, bye: 0, legBye: 0, penalty: 0 }
        }),
        { legalBall: false, extrasRuns: 1, totalRuns: 1 }
    );
    assert.deepEqual(
        getDeliveryTotals({
            batterRuns: 4,
            extras: { wide: 0, noBall: 1, bye: 0, legBye: 0, penalty: 0 }
        }),
        { legalBall: false, extrasRuns: 1, totalRuns: 5 }
    );
});

test("the default bowler limit is one fifth of the innings, rounded up", () => {
    assert.equal(getDefaultBowlerOverLimit(20), 4);
    assert.equal(getDefaultBowlerOverLimit(17), 4);
    assert.equal(getDefaultBowlerOverLimit(1), 1);
});

test("other delivery types count as legal balls", () => {
    assert.deepEqual(
        getDeliveryTotals({
            batterRuns: 0,
            extras: { wide: 0, noBall: 0, bye: 1, legBye: 0, penalty: 0 }
        }),
        { legalBall: true, extrasRuns: 1, totalRuns: 1 }
    );
    assert.deepEqual(
        getDeliveryTotals({
            batterRuns: 6,
            extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 }
        }),
        { legalBall: true, extrasRuns: 0, totalRuns: 6 }
    );
});

test("a no-ball can include byes and all extras count in the score", () => {
    assert.deepEqual(
        getDeliveryTotals({
            batterRuns: 0,
            extras: { wide: 0, noBall: 1, bye: 2, legBye: 0, penalty: 0 }
        }),
        { legalBall: false, extrasRuns: 3, totalRuns: 3 }
    );
});

test("innings end at the over limit, tenth wicket, or chase target", () => {
    assert.equal(
        isInningsComplete({
            legalBalls: 12,
            oversPerInnings: 2,
            wickets: 0,
            totalRuns: 0,
            targetRuns: null
        }),
        true
    );
    assert.equal(
        isInningsComplete({
            legalBalls: 0,
            oversPerInnings: 2,
            wickets: 10,
            totalRuns: 0,
            targetRuns: null
        }),
        true
    );
    assert.equal(
        isInningsComplete({
            legalBalls: 1,
            oversPerInnings: 2,
            wickets: 0,
            totalRuns: 8,
            targetRuns: 8
        }),
        true
    );
    assert.equal(
        isInningsComplete({
            legalBalls: 1,
            oversPerInnings: 2,
            wickets: 0,
            totalRuns: 7,
            targetRuns: 8
        }),
        false
    );
});
