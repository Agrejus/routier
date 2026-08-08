/**
 * Cosine distance, and the ordering rules that go with it.
 *
 * One implementation, shared by every in-memory path, because the promise the feature makes
 * is that a backend with no vector support returns the SAME ROWS IN THE SAME ORDER as one
 * that pushes the search down. Two copies of this arithmetic would drift, and the drift would
 * only ever show up as a conformance failure nobody could localise.
 *
 * The tie-breaking and degenerate cases below are chosen to match pgvector rather than to be
 * independently reasonable — parity is the point.
 */

/**
 * Distance in `[0, 2]`, or `Infinity` for a value that cannot be compared.
 *
 * `Infinity` covers three cases, and they all sort LAST, which is what PostgreSQL does too:
 * a missing value (`NULL` sorts last under `ASC` by default), a zero-magnitude vector
 * (pgvector's `<=>` yields `NaN`, which PostgreSQL orders after every real number), and a
 * stored vector of the wrong width.
 *
 * The width case cannot happen on a native `vector(n)` column — the engine rejects the write —
 * so it only arises on a backend storing JSON, where the data was written by something other
 * than this schema. Sorting it last rather than throwing keeps one corrupt row from failing a
 * query that is otherwise answerable.
 */
export const cosineDistance = (left: readonly number[] | null | undefined, right: readonly number[]): number => {
    if (left == null || left.length !== right.length) {
        return Infinity;
    }

    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let i = 0, length = right.length; i < length; i++) {
        const l = left[i];
        const r = right[i];

        dot += l * r;
        leftMagnitude += l * l;
        rightMagnitude += r * r;
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
        return Infinity;
    }

    return 1 - (dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)));
};

/**
 * The `count` rows closest to `vector`, nearest first.
 *
 * Distances are computed once per row rather than inside the comparator: a comparison-time
 * computation runs O(n log n) times over vectors that are commonly 1536 wide, which turns an
 * ordering into the dominant cost of the query.
 *
 * The sort is stable, so rows at equal distance keep the order the backend returned them in.
 * That is not a guarantee worth relying on across backends — two engines can hand back the
 * same rows in different orders — but it does mean this function never introduces a
 * difference of its own.
 */
export const nearestBy = <T>(
    rows: readonly T[],
    vector: number[],
    count: number,
    select: (row: T) => readonly number[] | null | undefined
): T[] => {
    if (count <= 0) {
        return [];
    }

    const scored = rows.map((row, index) => ({ row, index, distance: cosineDistance(select(row), vector) }));

    scored.sort((a, b) => {
        if (a.distance === b.distance) {
            // Infinity === Infinity, so unscoreable rows fall through to insertion order
            // rather than to `Infinity - Infinity`, which is NaN and would leave the
            // comparator inconsistent — V8 is free to produce any permutation from that.
            return a.index - b.index;
        }

        return a.distance - b.distance;
    });

    return scored.slice(0, count).map(x => x.row);
};
