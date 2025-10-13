import { s } from "@routier/core/schema";

// Type combination examples within schemas
const combinedSchema = s.define("combined", {
    id: s.string().key().identity(),

    // Combining string with array conversion
    singleTag: s.string().array(), // Converts string to string[]

    // Combining number with array conversion  
    singleScore: s.number().array(), // Converts number to number[]

    // Combining object with array conversion
    singleItem: s.object({
        name: s.string(),
        value: s.number(),
    }).array(), // Converts object to object[]

    // Combining boolean with array conversion
    singleFlag: s.boolean().array(), // Converts boolean to boolean[]

    // Combining date with array conversion
    singleDate: s.date().array(), // Converts date to date[]
}).compile();
