import { describe, expect, it } from "@jest/globals";
import { ComparatorExpression, OperatorExpression, PropertyExpression, ValueExpression } from "@routier/core/expressions";
import { getDialect, toSql } from "./sql";

const prop = (name: string, from?: string) =>
    new PropertyExpression({
        property: { name, from: from ?? null, getResolvedName: () => from ?? name } as any,
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

    it("renders renamed properties using the storage column name", () => {
        const expr = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: true,
            left: prop("city", "c"),
            right: val("NYC"),
        });

        const result = toSql(expr, "sqlite");

        expect(result.where).toBe(`"c" = ?`);
        expect(result.params).toEqual(["NYC"]);
    });
});

describe("sql expression translator — expanded syntax", () => {
    const propTyped = (name: string, type: string, transformer: string | null = null) => {
        const p = new PropertyExpression({
            property: { name, from: null, type, getResolvedName: () => name } as any,
        });
        p.transformer = transformer as any;
        return p;
    };

    it("renders an empty expression as a tautology", () => {
        const result = toSql({ type: "empty" } as any, "sqlite");
        expect(result.where).toBe("1 = 1");
        expect(result.params).toEqual([]);
    });

    it("renders property-to-property equality as column = column", () => {
        const expr = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: false,
            left: prop("updatedAt"),
            right: prop("createdAt"),
        });

        const result = toSql(expr, "postgresql");
        expect(result.where).toBe(`"updatedAt" = "createdAt"`);
        expect(result.params).toEqual([]);
    });

    it("wraps a to-lower-case property in LOWER for string matching", () => {
        const expr = new ComparatorExpression({
            comparator: "starts-with",
            negated: false,
            strict: false,
            left: propTyped("name", "String", "to-lower-case"),
            right: val("abc"),
        });

        const result = toSql(expr, "postgresql");
        expect(result.where).toBe(`LOWER("name") LIKE $1 ESCAPE E'\\\\'`);
        expect(result.params).toEqual(["abc%"]);
    });

    it("wraps a to-lower-case property in LOWER for equals", () => {
        const expr = new ComparatorExpression({
            comparator: "includes",
            negated: false,
            strict: false,
            left: propTyped("name", "String", "to-upper-case"),
            right: val("ABC"),
        });

        const result = toSql(expr, "sqlite");
        expect(result.where).toBe(`UPPER("name") GLOB ?`);
        expect(result.params).toEqual(["*ABC*"]);
    });

    it("applies a value transformer before binding", () => {
        const lowered = val("MiXeD");
        lowered.transformer = "to-lower-case";

        const expr = new ComparatorExpression({
            comparator: "starts-with",
            negated: false,
            strict: false,
            left: propTyped("name", "String", "to-lower-case"),
            right: lowered,
        });

        const result = toSql(expr, "mysql");
        expect(result.params).toEqual(["mixed%"]);
    });

    it("renders string length per dialect", () => {
        const expr = new ComparatorExpression({
            comparator: "greater-than",
            negated: false,
            strict: false,
            left: propTyped("name", "String", "length"),
            right: val(5),
        });

        expect(toSql(expr, "sqlite").where).toBe(`LENGTH("name") > ?`);
        expect(toSql(expr, "postgresql").where).toBe(`LENGTH("name") > $1`);
        expect(toSql(expr, "mysql").where).toBe("CHAR_LENGTH(`name`) > ?");
        expect(toSql(expr, "mssql").where).toBe(`LEN([name]) > @p1`);
    });

    it("renders array length with JSON length functions", () => {
        const expr = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: false,
            left: propTyped("tags", "Array", "length"),
            right: val(0),
        });

        expect(toSql(expr, "sqlite").where).toBe(`json_array_length("tags") = ?`);
        expect(toSql(expr, "postgresql").where).toBe(`jsonb_array_length("tags") = $1`);
        expect(toSql(expr, "mysql").where).toBe("JSON_LENGTH(`tags`) = ?");
    });

    it("renders inline array membership as IN with the value on the left", () => {
        const expr = new ComparatorExpression({
            comparator: "includes",
            negated: false,
            strict: false,
            left: val(["active", "pending"]),
            right: prop("status"),
        });

        const result = toSql(expr, "sqlite");
        expect(result.where).toBe(`"status" IN (?, ?)`);
        expect(result.params).toEqual(["active", "pending"]);
    });

    it("renders negated inline array membership as NOT IN", () => {
        const expr = new ComparatorExpression({
            comparator: "includes",
            negated: true,
            strict: false,
            left: val([1, 2]),
            right: prop("id"),
        });

        const result = toSql(expr, "postgresql");
        expect(result.where).toBe(`"id" NOT IN ($1, $2)`);
        expect(result.params).toEqual([1, 2]);
    });
});
