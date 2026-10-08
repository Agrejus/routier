export const SQLITE_MAX_PARAMS = 32_766;

export const SQLITE_MAX_OR_TERMS = 500;

export const rowsPerStatement = (paramsPerRow: number, maxRows: number = Number.POSITIVE_INFINITY): number =>
    Math.max(1, Math.min(maxRows, Math.floor(SQLITE_MAX_PARAMS / Math.max(1, paramsPerRow))));

export const chunksOf = <T>(items: readonly T[], size: number): T[][] => {
    const chunks: T[][] = [];

    for (let start = 0; start < items.length; start += size) {
        chunks.push(items.slice(start, start + size));
    }

    return chunks;
};
