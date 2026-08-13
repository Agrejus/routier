// Basic string
s.string();

// String with validation
s.string().email();
s.string().url();
s.string().uuid();
s.string().ipv4();
s.string().ipv6();
s.string().creditCard();
s.string().phoneNumber();

// String with constraints
s.string().min(1);
s.string().max(100);
s.string().length(10);

// String with pattern
s.string().pattern(/^[a-zA-Z]+$/);