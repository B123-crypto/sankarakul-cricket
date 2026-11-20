const maxBigInt = 9223372036854775807n;

export const isValidDatabaseId = (value) => {
    if (
        (typeof value !== "string" && typeof value !== "number") ||
        (typeof value === "number" && !Number.isSafeInteger(value))
    ) {
        return false;
    }

    const normalized = String(value);
    if (!/^\d+$/.test(normalized)) {
        return false;
    }

    try {
        const id = BigInt(normalized);
        return id > 0n && id <= maxBigInt;
    } catch {
        return false;
    }
};

export const normalizeDatabaseId = (value) => BigInt(String(value)).toString();
