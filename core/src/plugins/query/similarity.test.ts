import { cosineDistance, nearestBy } from "./similarity";
import { setLogLevel } from "../../utilities";

/**
 * The arithmetic every backend's fallback shares.
 *
 * The degenerate cases matter more than the ordinary one. A vector search over well-formed
 * data is hard to get wrong; what silently returns a plausible answer is a null embedding, a
 * zero vector, or a stored row of the wrong width — each of which has to sort LAST so the
 * result matches what pgvector produces for the same data.
 */

describe("cosineDistance", () => {

    it("is zero for identical direction, regardless of magnitude", () => {
        expect(cosineDistance([1, 0, 0], [1, 0, 0])).toBeCloseTo(0);
        // Cosine measures direction only, so scaling must not move the distance.
        expect(cosineDistance([2, 0, 0], [1, 0, 0])).toBeCloseTo(0);
        expect(cosineDistance([0.5, 0.5], [10, 10])).toBeCloseTo(0);
    });

    it("is one for orthogonal vectors and two for opposite ones", () => {
        expect(cosineDistance([1, 0], [0, 1])).toBeCloseTo(1);
        expect(cosineDistance([1, 0], [-1, 0])).toBeCloseTo(2);
    });

    it("orders by angle", () => {
        const query = [1, 0];

        const close = cosineDistance([1, 0.1], query);
        const far = cosineDistance([1, 5], query);

        expect(close).toBeLessThan(far);
    });

    it("returns Infinity for a value that cannot be compared", () => {
        // All three sort last, which is what PostgreSQL does for NULL and for the NaN that
        // pgvector yields on a zero-magnitude vector.
        expect(cosineDistance(null, [1, 2])).toBe(Infinity);
        expect(cosineDistance(undefined, [1, 2])).toBe(Infinity);
        expect(cosineDistance([0, 0], [1, 2])).toBe(Infinity);
        expect(cosineDistance([1, 2], [0, 0])).toBe(Infinity);
        expect(cosineDistance([1, 2, 3], [1, 2])).toBe(Infinity);
    });
});

describe("nearestBy", () => {

    type Row = { name: string, v: number[] | null };

    const rows: Row[] = [
        { name: "opposite", v: [-1, 0] },
        { name: "orthogonal", v: [0, 1] },
        { name: "exact", v: [1, 0] },
        { name: "close", v: [1, 0.1] },
    ];

    const select = (row: Row) => row.v;

    it("returns the closest rows, nearest first", () => {
        const result = nearestBy(rows, [1, 0], 3, select);

        expect(result.map(x => x.name)).toEqual(["exact", "close", "orthogonal"]);
    });

    it("limits to the requested count", () => {
        expect(nearestBy(rows, [1, 0], 1, select).map(x => x.name)).toEqual(["exact"]);
        expect(nearestBy(rows, [1, 0], 0, select)).toEqual([]);
        expect(nearestBy(rows, [1, 0], -5, select)).toEqual([]);
    });

    it("returns everything it has when asked for more than exists", () => {
        expect(nearestBy(rows, [1, 0], 100, select)).toHaveLength(4);
    });

    it("puts unscoreable rows last rather than dropping them", () => {
        const withGaps: Row[] = [
            { name: "missing", v: null },
            { name: "zero", v: [0, 0] },
            { name: "exact", v: [1, 0] },
        ];

        const result = nearestBy(withGaps, [1, 0], 3, select);

        expect(result[0].name).toBe("exact");
        // Both are Infinity, so they hold their input order rather than being compared —
        // `Infinity - Infinity` is NaN, and a comparator returning NaN leaves the sort
        // free to produce any permutation at all.
        expect(result.slice(1).map(x => x.name)).toEqual(["missing", "zero"]);
    });

    it("keeps input order for rows at equal distance", () => {
        const ties: Row[] = [
            { name: "first", v: [1, 0] },
            { name: "second", v: [2, 0] },
            { name: "third", v: [3, 0] },
        ];

        expect(nearestBy(ties, [1, 0], 3, select).map(x => x.name)).toEqual(["first", "second", "third"]);
    });

    it("does not mutate the rows it was given", () => {
        const original = [...rows];

        nearestBy(rows, [1, 0], 2, select);

        expect(rows).toEqual(original);
    });
});

describe("nearestBy: a wrong-width vector is reported, not just sorted last", () => {

    /**
     * The safe handling of a corrupt vector is also a silent one — it sorts last and is never
     * returned, so an embedding model that changed its output width degrades every search with
     * nothing to notice. The warning is the only signal, which makes it worth pinning: it costs
     * nothing when the data is clean, and it is exactly the kind of diagnostic that gets
     * removed by someone tidying a hot loop.
     */
    const withWarnings = async (body: () => void) => {
        const warnings: string[] = [];
        const original = console.warn;

        // The level is set explicitly rather than inherited: the suite runs with
        // ROUTIER_LOG_LEVEL=silent, so a test asserting on output has to ask for it.
        setLogLevel("warn");
        console.warn = (...args: unknown[]) => { warnings.push(args.join(" ")); };

        try {
            body();
        } finally {
            console.warn = original;
            setLogLevel("silent");
        }

        return warnings.join("\n");
    };

    it("warns once per query, naming how many rows are unusable", async () => {
        const rows = [
            { embedding: [1, 0, 0] },
            { embedding: [1, 0] },
            { embedding: [0, 1, 0, 0] },
        ];

        const output = await withWarnings(() => {
            nearestBy(rows, [1, 0, 0], 10, r => r.embedding);
        });

        expect(output).toMatch(/2 of 3 stored vectors are not 3 wide/);
    });

    it("says nothing when every vector is the declared width", async () => {
        const rows = [{ embedding: [1, 0, 0] }, { embedding: [0, 1, 0] }];

        const output = await withWarnings(() => {
            nearestBy(rows, [1, 0, 0], 10, r => r.embedding);
        });

        expect(output).toBe("");
    });

    it("still returns the usable rows first", async () => {
        // The warning must not change the answer — a corrupt row is reported AND sorted last.
        const rows = [
            { label: "short", embedding: [1, 0] },
            { label: "exact", embedding: [1, 0, 0] },
        ];

        const found = nearestBy(rows, [1, 0, 0], 10, r => r.embedding);

        expect(found.map(r => r.label)).toEqual(["exact", "short"]);
    });
});
