import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

const UNIT_TEST_ROOTS = ["core/src", "datastore/src", "plugins"];

const SKIPPED = new Set(["node_modules", "dist", "coverage", "dbs"]);

const BUDGET = /expect\(\s*(?:end\s*-\s*start|\w*(?:[Tt]ime|[Dd]uration|[Ee]lapsed|PerOp)\w*)\s*\)\s*\.toBeLessThan(?:OrEqual)?\(\s*\d/g;

const testFilesUnder = (directory: string): string[] => {
    if (fs.existsSync(directory) === false) {
        return [];
    }

    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (SKIPPED.has(entry.name)) {
            return [];
        }

        const full = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            return testFilesUnder(full);
        }

        return /\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });
};

const budgetsIn = (source: string): string[] => source.match(BUDGET) ?? [];

describe("unit tests assert no wall-clock budgets", () => {
    it("finds a budget written the ways the old tests wrote them", () => {
        expect(budgetsIn([
            "expect(end - start).toBeLessThan(100);",
            "expect(avgTimePerOp).toBeLessThan(100);",
            "expect(totalTime).toBeLessThan(5000);",
            "expect(saveTime).toBeLessThan(1000);",
            "expect(duration).toBeLessThanOrEqual(50);",
            "expect(elapsedMs).toBeLessThan( 2);",
        ].join("\n"))).toHaveLength(6);
    });

    it("allows a duration compared with another measurement", () => {
        expect(budgetsIn([
            "expect(events[0].durationMs).toBeLessThanOrEqual(performance.now() - before);",
            "expect(queries[0].durationMs).toBeLessThanOrEqual(elapsed);",
            "expect(result.size).toBeLessThan(1000);",
        ].join("\n"))).toEqual([]);
    });

    it("has no absolute timing assertion in a unit test", () => {
        const offenders = UNIT_TEST_ROOTS
            .flatMap(root => testFilesUnder(path.join(REPO_ROOT, root)))
            .flatMap(file => budgetsIn(fs.readFileSync(file, "utf8")).map(budget => `${path.relative(REPO_ROOT, file)}: ${budget}`));

        expect(offenders).toEqual([]);
    });
});
