import { s } from "@routier/core/schema";

// Converting types to arrays within schemas
const dataSchema = s.define("data", {
    // String to array
    stringArray: s.string().array(),

    // Number to array
    numberArray: s.number().array(),

    // Boolean to array
    booleanArray: s.boolean().array(),

    // Date to array
    dateArray: s.date().array(),

    // Object to array
    objectArray: s.object({
        name: s.string(),
        value: s.number(),
    }).array(),
}).compile();
