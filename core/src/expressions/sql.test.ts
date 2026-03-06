import { describe, expect, it } from "@jest/globals";
import { ComparatorExpression, OperatorExpression, PropertyExpression, ValueExpression } from "./types";
import { getDialect, toSql } from "./sql";

const prop = (name: string) =>
    new PropertyExpression({
        property: { name } as any,
    });

const val = (value: unknown) =>
    new ValueExpression({
        value,
    });

describe("sql expression translator", () => {
    it("renders equals for sqlite with positional placeholders", () => {
        const expr = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: false,
            left: prop("name"),
            right: val("Ada"),
        });

        const result = toSql(expr, "sqlite");
        expect(result.where).toBe(`"name" = ?`);
        expect(result.params).toEqual(["Ada"]);
    });

    it("renders null equals using IS NULL without params", () => {
        const expr = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: false,
            left: prop("deletedAt"),
            right: val(null),
        });

        const result = toSql(expr, "postgresql");
        expect(result.where).toBe(`"deletedAt" IS NULL`);
        expect(result.params).toEqual([]);
    });

    it("renders value-on-left null equals with placeholder", () => {
        const expr = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: false,
            left: val(null),
            right: prop("deletedAt"),
        });

        const result = toSql(expr, "postgresql");
        expect(result.where).toBe(`$1 IS NULL`);
        expect(result.params).toEqual([null]);
    });

    it("renders includes array as IN clause", () => {
        const expr = new ComparatorExpression({
            comparator: "includes",
            negated: false,
            strict: false,
            left: prop("id"),
            right: val([1, 2, 3]),
        });

        const result = toSql(expr, "mysql");
        expect(result.where).toBe("`id` IN (?, ?, ?)");
        expect(result.params).toEqual([1, 2, 3]);
    });

    it("renders starts-with with LIKE and ESCAPE for postgres", () => {
        const expr = new ComparatorExpression({
            comparator: "starts-with",
            negated: false,
            strict: false,
            left: prop("name"),
            right: val("a_%"),
        });

        const result = toSql(expr, "postgresql");
        expect(result.where).toBe(`"name" LIKE $1 ESCAPE E'\\\\'`);
        expect(result.params).toEqual(["a\\_\\%%"]);
    });

    it("renders ends-with with GLOB for sqlite", () => {
        const expr = new ComparatorExpression({
            comparator: "ends-with",
            negated: false,
            strict: false,
            left: prop("name"),
            right: val("xyz"),
        });

        const result = toSql(expr, "sqlite");
        expect(result.where).toBe(`"name" GLOB ?`);
        expect(result.params).toEqual(["*xyz"]);
    });

    it("renders nested logical operators and increments placeholders", () => {
        const left = new ComparatorExpression({
            comparator: "greater-than",
            negated: false,
            strict: false,
            left: prop("age"),
            right: val(18),
        });
        const right = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: false,
            left: prop("active"),
            right: val(true),
        });
        const expr = new OperatorExpression({
            operator: "&&",
            left,
            right,
        });

        const result = toSql(expr, "mssql");
        expect(result.where).toBe(`([age] > @p1 AND [active] = @p2)`);
        expect(result.params).toEqual([18, true]);
    });

    it("throws for unsupported complex includes expressions", () => {
        const expr = new ComparatorExpression({
            comparator: "includes",
            negated: false,
            strict: false,
            left: val("x"),
            right: val("y"),
        });

        expect(() => toSql(expr, "sqlite")).toThrow("Complex expressions not supported for includes operations");
    });

    it("throws on unknown dialect at runtime", () => {
        expect(() => getDialect("oracle" as any)).toThrow("Unknown SQL dialect: oracle");
    });
});
