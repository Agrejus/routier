import { describe, expect, it } from "@jest/globals";
import { findReport } from "./report";

describe("findReport", () => {
    it("writes every filter value as a parameter, in order", () => {
        const when = new Date("2024-01-01T00:00:00.000Z");

        expect(findReport("orders", { $and: [{ status: "paid" }, { total: { $gt: 10, $in: [1, 2] } }], placed: when }, {})).toEqual({
            text: 'db.orders.find({ "$and": [{ "status": ? }, { "total": { "$gt": ?, "$in": [?, ?] } }], "placed": ? })',
            parameters: ["paid", 10, 1, 2, when],
            language: "mongodb",
        });
    });

    it("keeps the find options as they are", () => {
        expect(findReport("orders", {}, { sort: { total: -1 }, skip: 5, limit: 10 })).toEqual({
            text: 'db.orders.find({}, {"sort":{"total":-1},"skip":5,"limit":10})',
            language: "mongodb",
        });
    });

    it("writes an undefined value as a parameter", () => {
        expect(findReport("orders", { status: undefined }, {})).toEqual({ text: 'db.orders.find({ "status": ? })', parameters: [undefined], language: "mongodb" });
    });

    it("leaves out options there are none of", () => {
        expect(findReport("orders", { status: null }, {}).text).toBe('db.orders.find({ "status": ? })');
    });
});
