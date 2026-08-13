// Basic function property
w.function((entity) => function)

// Function with parameters
w.function((entity) => (param1, param2) => result)

// Function with validation
w.function((entity) => function).validate((fn) => boolean)