import { describe, expect, it } from "@jest/globals";
import { s } from "../schema";
import { QueryOptionsCollection } from "../plugins/query/QueryOptionsCollection";
import { filtersSensitive, HIDDEN_QUERY_TEXT, redactExecutedQueries } from "../plugins/query/redactQueries";
import { toExpression } from "./parser";
import { REDACTED, redactExpression, touchesSensitive } from "./redact";
import { ComparatorExpression, Expression, OperatorExpression } from "./types";

const schema = s.define("redact_people", {
    id: s.string().key(),
    name: s.string(),
    age: s.number(),
    ssn: s.string().sensitive(),
}).compile();

type Person = { id: string; name: string; age: number; ssn: string };

const parse = (filter: (person: Person) => boolean) => toExpression(schema, filter);

const json = (expression: Expression) => JSON.stringify(Expression.toJson(redactExpression(expression)));

describe("redactExpression", () => {
    it("hides a literal compared with a sensitive property", () => {
        const redacted = json(parse(p => p.ssn === "123-45-6789"));

        expect(redacted).not.toContain("123-45-6789");
        expect(redacted).toContain(REDACTED);
    });

    it("keeps a literal compared with another property", () => {
        expect(json(parse(p => p.name === "Ada"))).toContain("Ada");
    });

    it("hides only the sensitive side of an && or ||", () => {
        const redacted = json(parse(p => p.name === "Ada" && (p.ssn === "123" || p.age > 40)));

        expect(redacted).toContain("Ada");
        expect(redacted).toContain("40");
        expect(redacted).not.toContain("\"123\"");
    });

    it("hides the arguments of a call on a sensitive property", () => {
        const redacted = json(parse(p => p.ssn.startsWith("999")));

        expect(redacted).not.toContain("999");
    });

    it("hides a literal inside a call compared with a sensitive property", () => {
        const redacted = json(parse(p => p.ssn.toLowerCase() === "abc"));

        expect(redacted).not.toContain("abc");
    });

    it("returns an expression with nothing sensitive as it is", () => {
        const expression = parse(p => p.age > 40);

        expect(redactExpression(expression)).toBe(expression);
    });

    it("keeps an operator side that is missing", () => {
        const redacted = Expression.toJson(redactExpression(new OperatorExpression({ operator: "&&", left: parse(p => p.ssn === "x") })));

        expect(redacted).toEqual({ type: "operator", operator: "&&", left: expect.objectContaining({ type: "comparator" }) });
        expect(JSON.stringify(redacted)).not.toContain("\"x\"");
    });

    it("keeps a comparison side that is missing", () => {
        const comparison = new ComparatorExpression({ comparator: "equals", negated: false, strict: true, left: parse(p => p.ssn === "x").left });

        expect(Expression.toJson(redactExpression(comparison))).toEqual({
            type: "comparator", comparator: "equals", negated: false, strict: true, left: { type: "property", path: "ssn" },
        });
    });
});

describe("touchesSensitive", () => {
    it("is true when the expression reads a sensitive property", () => {
        expect(touchesSensitive(parse(p => p.age > 1 && p.ssn === "x"))).toBe(true);
    });

    it("is false otherwise", () => {
        expect(touchesSensitive(parse(p => p.age > 1))).toBe(false);
    });
});

const optionsFiltering = (filter: (person: Person) => boolean) => {
    const options = new QueryOptionsCollection<Person>();

    options.add("filter", { filter, expression: parse(filter), params: undefined });

    return options;
};

describe("filtersSensitive", () => {
    it("is true when a filter reads a sensitive property", () => {
        expect(filtersSensitive(optionsFiltering(p => p.ssn === "x"))).toBe(true);
    });

    it("is false when no filter does", () => {
        expect(filtersSensitive(optionsFiltering(p => p.name === "x"))).toBe(false);
        expect(filtersSensitive(new QueryOptionsCollection<Person>())).toBe(false);
    });
});

describe("redactExecutedQueries", () => {
    const queries = [
        { text: "SELECT * FROM people WHERE ssn = ?", parameters: ["123", 4] },
        { text: "{\"ssn\":\"123\"}" },
    ];

    it("hides parameters, and the text of a statement that has none", () => {
        expect(redactExecutedQueries(queries, true)).toEqual([
            { text: "SELECT * FROM people WHERE ssn = ?", parameters: [REDACTED, REDACTED] },
            { text: HIDDEN_QUERY_TEXT },
        ]);
    });

    it("returns the statements as they are when nothing is hidden", () => {
        expect(redactExecutedQueries(queries, false)).toBe(queries);
    });
});
