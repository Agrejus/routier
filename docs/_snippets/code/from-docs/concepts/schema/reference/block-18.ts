// Custom serialization
s.date().serialize((date) => string);
s.number().serialize((num) => string);

// Custom deserialization
s.date().deserialize((str) => Date);
s.number().deserialize((str) => number);