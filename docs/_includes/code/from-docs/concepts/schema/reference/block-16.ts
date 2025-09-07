// Default values
s.string().default("value");
s.number().default(0);
s.boolean().default(true);
s.date().default(() => new Date());
s.array(s.string()).default(() => []);

// Required fields
s.string().required();

// Optional fields
s.string().optional();