import { describe, expect, it } from "@jest/globals";
import { CallExpression, ComparatorExpression, PropertyExpression, ValueExpression } from "@routier/core/expressions";
import { SchemaTypes } from "@routier/core";
import { toSql } from "./sql";

/**
 * Filtering into a nested property.
 *
 * A nested subtree is stored as ONE JSON column named for its root (`sqlColumnProperties`),
 * so `payload.inner.value` is a path into the `payload` column rather than a column of its
 * own. Before `jsonPathExpression` existed the translator rendered the leaf name alone and
 * emitted `"value" = $1` — valid SQL naming a column that does not exist, which is why the
 * shape assertions in `sql.test.ts` never caught it.
 */

const nested = (
    name: string,
    parents: string[],
    type: SchemaTypes = SchemaTypes.String
) =>
    new PropertyExpression({
        property: {
            name,
            from: null,
            type,
            getResolvedName: () => name,
            getParentPathArray: (): string[] => parents,
        } as any,
    });

const val = (value: unknown) => new ValueExpression({ value });

const equals = (left: any, right: any) =>
    new ComparatorExpression({ comparator: "equals", negated: false, strict: false, left, right });

describe("json path extraction", () => {

    describe("string leaf", () => {
        const expr = () => equals(nested("value", ["payload", "inner"]), val("deep"));

        it("uses json_extract for sqlite", () => {
            expect(toSql(expr(), "sqlite").where).toBe(
                `json_extract("payload", '$.inner.value') = ?`
            );
        });

        it("navigates with -> and extracts text with ->> for postgres", () => {
            expect(toSql(expr(), "postgresql").where).toBe(
                `"payload"->'inner'->>'value' = $1`
            );
        });

        it("unquotes the JSON scalar for mysql", () => {
            // JSON_EXTRACT alone returns `"deep"` — quotes included — so `= 'deep'` never
            // matches. JSON_UNQUOTE is what makes the comparison work at all.
            expect(toSql(expr(), "mysql").where).toBe(
                "JSON_UNQUOTE(JSON_EXTRACT(`payload`, '$.inner.value')) = ?"
            );
        });

        it("uses JSON_VALUE for mssql", () => {
            expect(toSql(expr(), "mssql").where).toBe(
                `JSON_VALUE([payload], '$.inner.value') = @p1`
            );
        });

        it("binds the value as a parameter, not into the path", () => {
            expect(toSql(expr(), "postgresql").params).toEqual(["deep"]);
        });
    });

    describe("numeric leaf", () => {
        const expr = () =>
            new ComparatorExpression({
                comparator: "greater-than",
                negated: false,
                strict: false,
                left: nested("count", ["payload", "inner"], SchemaTypes.Number),
                right: val(9),
            });

        /**
         * The cast is the whole point. Extracted as text, `'10' > '9'` is false, so a
         * numeric filter silently drops every double-digit row.
         */
        it("casts to numeric for postgres", () => {
            expect(toSql(expr(), "postgresql").where).toBe(
                `("payload"->'inner'->>'count')::numeric > $1`
            );
        });

        it("casts to decimal for mysql", () => {
            expect(toSql(expr(), "mysql").where).toBe(
                "CAST(JSON_UNQUOTE(JSON_EXTRACT(`payload`, '$.inner.count')) AS DECIMAL(65,30)) > ?"
            );
        });

        it("casts to float for mssql", () => {
            expect(toSql(expr(), "mssql").where).toBe(
                `CAST(JSON_VALUE([payload], '$.inner.count') AS FLOAT) > @p1`
            );
        });

        it("needs no cast for sqlite, whose json_extract is already typed", () => {
            expect(toSql(expr(), "sqlite").where).toBe(
                `json_extract("payload", '$.inner.count') > ?`
            );
        });
    });

    describe("boolean leaf", () => {
        const expr = () => equals(nested("active", ["flags"], SchemaTypes.Boolean), val(true));

        it("casts to boolean for postgres", () => {
            expect(toSql(expr(), "postgresql").where).toBe(
                `("flags"->>'active')::boolean = $1`
            );
        });

        /**
         * MySQL yields the text 'true'/'false' while the driver binds a JS boolean as 1/0,
         * so the comparison is rewritten to produce 1/0 rather than cast.
         */
        it("compares against the text form for mysql, producing 1/0", () => {
            expect(toSql(expr(), "mysql").where).toBe(
                "(JSON_UNQUOTE(JSON_EXTRACT(`flags`, '$.active')) = 'true') = ?"
            );
        });
    });

    describe("path shape", () => {

        it("handles a single level below the root", () => {
            expect(toSql(equals(nested("value", ["payload"]), val("x")), "postgresql").where).toBe(
                `"payload"->>'value' = $1`
            );
        });

        it("handles three levels below the root", () => {
            expect(toSql(equals(nested("d", ["a", "b", "c"]), val("x")), "postgresql").where).toBe(
                `"a"->'b'->'c'->>'d' = $1`
            );
        });

        it("leaves a root property as a plain column", () => {
            expect(toSql(equals(nested("name", []), val("James")), "postgresql").where).toBe(
                `"name" = $1`
            );
        });
    });

    describe("segment escaping", () => {

        /**
         * `.from()` accepts any string. An unquoted segment containing a dot would address a
         * different level of the document, silently.
         */
        it("quotes a segment that is not a plain identifier", () => {
            expect(toSql(equals(nested("odd.key", ["payload"]), val("x")), "sqlite").where).toBe(
                `json_extract("payload", '$."odd.key"') = ?`
            );
        });

        it("escapes a single quote so the path literal cannot be broken out of", () => {
            expect(toSql(equals(nested("it's", ["payload"]), val("x")), "sqlite").where).toBe(
                `json_extract("payload", '$."it''s"') = ?`
            );
        });

        it("escapes a double quote inside a quoted segment", () => {
            expect(toSql(equals(nested('a"b', ["payload"]), val("x")), "sqlite").where).toBe(
                `json_extract("payload", '$."a\\"b"') = ?`
            );
        });
    });

    describe("composition with other renderers", () => {

        it("applies a transformer on top of the extracted value", () => {
            const property = new CallExpression({
                call: "to-lower-case",
                expression: nested("value", ["payload", "inner"]),
            });

            expect(toSql(equals(property, val("deep")), "postgresql").where).toBe(
                `LOWER("payload"->'inner'->>'value') = $1`
            );
        });

        it("renders a pattern match against an extracted value", () => {
            const expr = new ComparatorExpression({
                comparator: "starts-with",
                negated: false,
                strict: false,
                left: nested("value", ["payload", "inner"]),
                right: val("de"),
            });

            const result = toSql(expr, "postgresql");

            expect(result.where).toBe(`"payload"->'inner'->>'value' LIKE $1 ESCAPE E'\\\\'`);
            expect(result.params).toEqual(["de%"]);
        });

        it("renders a null test against an extracted value", () => {
            expect(toSql(equals(nested("value", ["payload"]), val(null)), "postgresql").where).toBe(
                `"payload"->>'value' IS NULL`
            );
        });
    });
});
