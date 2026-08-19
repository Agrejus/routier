import { describe, expect, it } from "@jest/globals";
import { ComparatorExpression, OperatorExpression, PropertyExpression, ValueExpression } from "@routier/core/expressions";
import { getDialect, toSql } from "./sql";

const prop = (name: string, from?: string) =>
    new PropertyExpression({
        property: { name, from: from ?? null, getResolvedName: () => from ?? name, getParentPathArray: (): string[] => [] } as any,
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
            right: val("James"),
        });

        const result = toSql(expr, "sqlite");
        expect(result.where).toBe(`"name" = ?`);
        expect(result.params).toEqual(["James"]);
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

    // Previously asserted `$1 IS NULL` with a bound null — the tautology
    // `NULL IS NULL`, true for every row. A null test has no mirrored form, so
    // the reversed operand order must render exactly the column-on-left output.
    it("renders value-on-left null equals as the column test, no params", () => {
        const expr = new ComparatorExpression({
            comparator: "equals",
            negated: false,
            strict: false,
            left: val(null),
            right: prop("deletedAt"),
        });

        const result = toSql(expr, "postgresql");
        expect(result.where).toBe(`"deletedAt" IS NULL`);
        expect(result.params).toEqual([]);
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
            property: { name, from: null, type, getResolvedName: () => name, getParentPathArray: (): string[] => [] } as any,
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

// A null comparison is the one equals case with no mirrored form: reversing the
// operands must not change the SQL. The matrix runs both operand orders and both
// polarities against every dialect, because the bug it guards against —
// `? IS NULL`, a row-independent tautology — is silent. It returns every row
// instead of erroring, so only an assertion on the rendered text catches it.
describe("null comparisons render identically in both operand orders", () => {
    const dialects = [
        { name: "sqlite" as const, quoted: `"deletedAt"` },
        { name: "postgresql" as const, quoted: `"deletedAt"` },
        { name: "mysql" as const, quoted: "`deletedAt`" },
    ];

    for (const { name, quoted } of dialects) {
        describe(name, () => {
            const cases = [
                { label: "column on left", left: prop("deletedAt"), right: val(null) },
                { label: "column on right", left: val(null), right: prop("deletedAt") },
            ];

            for (const { label, left, right } of cases) {
                it(`renders IS NULL with ${label}`, () => {
                    const result = toSql(
                        new ComparatorExpression({
                            comparator: "equals",
                            negated: false,
                            strict: false,
                            left,
                            right,
                        }),
                        name
                    );

                    expect(result.where).toBe(`${quoted} IS NULL`);
                    expect(result.params).toEqual([]);
                });

                it(`renders IS NOT NULL with ${label}, negated`, () => {
                    const result = toSql(
                        new ComparatorExpression({
                            comparator: "equals",
                            negated: true,
                            strict: false,
                            left,
                            right,
                        }),
                        name
                    );

                    expect(result.where).toBe(`${quoted} IS NOT NULL`);
                    expect(result.params).toEqual([]);
                });
            }

            it("still binds a parameter for a non-null value in either order", () => {
                const ph = name === "postgresql" ? "$1" : "?";

                const columnLeft = toSql(
                    new ComparatorExpression({
                        comparator: "equals",
                        negated: false,
                        strict: false,
                        left: prop("deletedAt"),
                        right: val("x"),
                    }),
                    name
                );
                expect(columnLeft.where).toBe(`${quoted} = ${ph}`);
                expect(columnLeft.params).toEqual(["x"]);

                const columnRight = toSql(
                    new ComparatorExpression({
                        comparator: "equals",
                        negated: false,
                        strict: false,
                        left: val("x"),
                        right: prop("deletedAt"),
                    }),
                    name
                );
                expect(columnRight.where).toBe(`${ph} = ${quoted}`);
                expect(columnRight.params).toEqual(["x"]);
            });
        });
    }

    it("renders a renamed column, not the property name", () => {
        const result = toSql(
            new ComparatorExpression({
                comparator: "equals",
                negated: false,
                strict: false,
                left: val(null),
                right: prop("deletedAt", "deleted_at"),
            }),
            "postgresql"
        );

        expect(result.where).toBe(`"deleted_at" IS NULL`);
        expect(result.params).toEqual([]);
    });
});
