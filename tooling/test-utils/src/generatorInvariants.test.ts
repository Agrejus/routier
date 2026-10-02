import { describe } from "@jest/globals";
import { describeGeneratorInvariants } from "./generatorInvariants";

// One case per (shape, invariant, property order). The volume comes from the catalog, not
// from hand-written tests: adding a shape spec adds coverage across every invariant at once.
describe("generator invariants", () => {
    describeGeneratorInvariants();
});
