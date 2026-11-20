export const getDeliveryTotals = ({ batterRuns, extras }) => {
    const extrasRuns =
        extras.wide +
        extras.noBall +
        extras.bye +
        extras.legBye +
        extras.penalty;

    return {
        legalBall: extras.wide === 0 && extras.noBall === 0,
        extrasRuns,
        totalRuns: batterRuns + extrasRuns
    };
};

export const isInningsComplete = ({
    legalBalls,
    oversPerInnings,
    wickets,
    totalRuns,
    targetRuns
}) =>
    wickets >= 10 ||
    legalBalls >= oversPerInnings * 6 ||
    (targetRuns !== null && targetRuns !== undefined && totalRuns >= targetRuns);

export const getDefaultBowlerOverLimit = (oversPerInnings) =>
    Math.ceil(oversPerInnings / 5);
