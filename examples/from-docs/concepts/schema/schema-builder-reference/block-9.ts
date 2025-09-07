// Available on all types
s.string().array()                    // string[] -> string[][]
s.number().array()                    // number[] -> number[][]
s.boolean().array()                   // boolean[] -> boolean[][]
s.date().array()                      // Date[] -> Date[][]
s.object({...}).array()               // object[] -> object[][]
s.array(s.string()).array()           // string[][] -> string[][][]