import { describe, expect, it } from "@jest/globals";
import { Query } from "../query/Query";
import { QueryOptionsCollection } from "../query/QueryOptionsCollection";
import { QueryOption, QueryOrdering } from "../query/types";
import { s } from "../../schema";
import { TupleTranslator } from "./TupleTranslator";

type Pair = { name: string; rank: number };

const schema = s.define("tuple_translator", { id: s.string().key(), name: s.string() }).compile();

const translator = () => new TupleTranslator(new Query(QueryOptionsCollection.EMPTY<Pair>(), schema));

const byRank: QueryOption<Pair, "sort"> = {
    name: "sort",
    value: { selector: pair => pair.rank, direction: QueryOrdering.Descending, propertyName: "rank" },
    target: "memory",
    reason: "after-join",
};

describe("TupleTranslator.sort", () => {
    it("sorts rows by the option", () => {
        const pairs: Pair[] = [{ name: "a", rank: 1 }, { name: "b", rank: 2 }];

        expect(translator().sort<Pair[]>(pairs, byRank).map(pair => pair.name)).toEqual(["b", "a"]);
    });

    it("returns a value that is not an array as it is", () => {
        const single = { total: 3 };

        expect(translator().sort(single, byRank)).toBe(single);
    });
});
