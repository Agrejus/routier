// Range validation
s.number().min(0).max(100);
s.string().min(1).max(100);
s.array(s.string()).min(1).max(10);

// Pattern validation
s.string().pattern(/regex/);

// Custom validation
s.string().validate((value) => boolean | string);