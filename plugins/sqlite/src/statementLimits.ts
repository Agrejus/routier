export type StatementLimits = {
    readonly maxParams: number;
    readonly maxOrTerms: number;
};

export const SQLITE_LIMITS: StatementLimits = { maxParams: 32_766, maxOrTerms: 500 };

export const D1_LIMITS: StatementLimits = { maxParams: 100, maxOrTerms: 500 };

export const rowsPerStatement = (limits: StatementLimits, paramsPerRow: number, maxRows: number = Number.POSITIVE_INFINITY): number =>
    Math.max(1, Math.min(maxRows, Math.floor(limits.maxParams / Math.max(1, paramsPerRow))));

export const chunksOf = <T>(items: readonly T[], size: number): T[][] => {
    const chunks: T[][] = [];

    for (let start = 0; start < items.length; start += size) {
        chunks.push(items.slice(start, start + size));
    }

    return chunks;
};
