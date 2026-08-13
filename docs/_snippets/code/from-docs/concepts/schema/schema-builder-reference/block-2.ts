// String types
s.string()                           // Any string
s.string<"active" | "inactive">()   // Constrained to specific values

// Number types
s.number()                           // Any number
s.number<1 | 2 | 3 | 4 | 5>()      // Constrained to specific values

// Boolean types
s.boolean()                          // Any boolean
s.boolean<true>()                   // Only true allowed

// Date types
s.date()                            // Any date
s.date<Date>()                     // Generic date (same as above)

// Array types
s.array(s.string())                 // Array of strings
s.array(s.number())                 // Array of numbers
s.array(s.object({...}))            // Array of objects

// Object types
s.object({                          // Object with nested schema
  name: s.string(),
  age: s.number()
})