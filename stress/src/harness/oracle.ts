/**
 * A plain `Map` model of what the database should contain.
 *
 * The point of an oracle is independence: it shares no code with the change tracker, the
 * codegen pipeline, or any plugin, so agreement between the two is evidence rather than
 * tautology. `countAsync` returning the number the tracker also believes proves nothing;
 * matching a Map that only ever saw `set`/`delete` calls does.
 *
 * Comparison reports the first handful of divergences rather than a whole-object diff.
 * At 100k entities a full dump is unreadable and Jest truncates it anyway, so the failure
 * message has to lead with counts and a bounded sample.
 */
export class Oracle<T extends Record<string, any>> {
    private readonly entries = new Map<string, T>();

    constructor(private readonly keyOf: (entity: T) => string) { }

    get size() {
        return this.entries.size;
    }

    get ids(): string[] {
        return [...this.entries.keys()];
    }

    set(entity: T) {
        this.entries.set(this.keyOf(entity), entity);
    }

    delete(entity: T | string) {
        this.entries.delete(typeof entity === 'string' ? entity : this.keyOf(entity));
    }

    get(id: string) {
        return this.entries.get(id);
    }

    has(id: string) {
        return this.entries.has(id);
    }

    values(): T[] {
        return [...this.entries.values()];
    }

    /** Absorbs another oracle's entries. Used by the multi-worker scenarios to union. */
    merge(other: Oracle<T>) {
        for (const entity of other.values()) {
            this.set(entity);
        }
    }
}

export type OracleDivergence = {
    readonly kind: 'missing' | 'unexpected' | 'mismatch';
    readonly id: string;
    readonly detail?: string;
};

export type OracleComparison = {
    readonly matches: boolean;
    readonly expectedCount: number;
    readonly actualCount: number;
    readonly divergences: readonly OracleDivergence[];
    /** Total divergences found, which may exceed `divergences.length`. */
    readonly divergenceCount: number;
};

export type CompareOptions<T> = {
    /**
     * Fields to compare beyond identity. Omit to check membership only — useful when the
     * scenario's hunt is data loss rather than data corruption, and when the backend
     * legitimately reshapes values (SQLite has no boolean or date column type).
     */
    readonly fields?: readonly (keyof T)[];
    /** How many divergences to include in the report. */
    readonly sampleSize?: number;
};

/** Normalizes a value so a Date and its serialized round-trip compare equal. */
const normalize = (value: unknown): unknown => {
    // `instanceof Date` is unreliable inside Jest: values that crossed a realm boundary
    // (structuredClone, vm contexts) have a different Date constructor. Duck-type on the
    // method instead, which survives the crossing.
    if (value != null && typeof (value as any).getTime === 'function') {
        return (value as Date).getTime();
    }

    if (Array.isArray(value)) {
        return value.map(normalize);
    }

    if (value != null && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value as object).sort()) {
            out[key] = normalize((value as any)[key]);
        }
        return out;
    }

    return value;
};

const sameValue = (a: unknown, b: unknown) =>
    JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

export function compareToOracle<T extends Record<string, any>>(
    oracle: Oracle<T>,
    actual: readonly T[],
    keyOf: (entity: T) => string,
    options: CompareOptions<T> = {}
): OracleComparison {
    const sampleSize = options.sampleSize ?? 5;
    const divergences: OracleDivergence[] = [];
    let divergenceCount = 0;

    const record = (divergence: OracleDivergence) => {
        divergenceCount++;
        if (divergences.length < sampleSize) {
            divergences.push(divergence);
        }
    };

    const seen = new Set<string>();

    for (const entity of actual) {
        const id = keyOf(entity);

        // A duplicate id in the result set is its own defect class — id collisions at
        // volume are exactly what S1 hunts — so it is reported rather than deduplicated.
        if (seen.has(id)) {
            record({ kind: 'unexpected', id, detail: 'duplicate id in result set' });
            continue;
        }
        seen.add(id);

        const expected = oracle.get(id);

        if (expected == null) {
            record({ kind: 'unexpected', id });
            continue;
        }

        for (const field of options.fields ?? []) {
            if (sameValue(expected[field], entity[field]) === false) {
                record({
                    kind: 'mismatch',
                    id,
                    detail: `${String(field)}: expected ${JSON.stringify(normalize(expected[field]))}, got ${JSON.stringify(normalize(entity[field]))}`,
                });
                break;
            }
        }
    }

    for (const id of oracle.ids) {
        if (seen.has(id) === false) {
            record({ kind: 'missing', id });
        }
    }

    return {
        matches: divergenceCount === 0,
        expectedCount: oracle.size,
        actualCount: actual.length,
        divergences,
        divergenceCount,
    };
}

/** A multi-line report suitable for a failure message. */
export function describeComparison(comparison: OracleComparison): string {
    if (comparison.matches) {
        return 'oracle matches';
    }

    const lines = [
        `oracle mismatch: expected ${comparison.expectedCount} entities, got ${comparison.actualCount}`,
        `${comparison.divergenceCount} divergence(s), first ${comparison.divergences.length}:`,
        ...comparison.divergences.map(
            d => `  ${d.kind} ${d.id}${d.detail == null ? '' : ` — ${d.detail}`}`
        ),
    ];

    return lines.join('\n');
}
