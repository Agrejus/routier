const schema = s.define("users", {
  // Basic number
  age: s.number(),

  // Number with literal constraints
  priority: s.number<1 | 2 | 3 | 4 | 5>(),
  score: s.number<0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100>(),

  // Number with modifiers
  count: s.number().default(0),
  rating: s.number().index(),
  version: s.number().identity(),
  // Note: .default() accepts both direct values and functions
});