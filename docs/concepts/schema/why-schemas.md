# Why Schemas?

Schemas are the foundation of Routier's data management system. This document explains why schemas are important and how they benefit your application.

## What Are Schemas?

A schema is a blueprint that defines:

- **Structure** - What properties your data has
- **Types** - What kind of values each property can hold
- **Constraints** - Rules that data must follow
- **Behavior** - How properties should behave (computed, tracked, etc.)
- **Metadata** - Information for indexing, relationships, and more

## Benefits of Using Schemas

### 1. **Type Safety**

Schemas provide compile-time type checking and type safety:

```typescript
// Without schemas - prone to errors
const user = {
  name: "John",
  age: "thirty", // Oops! Age should be a number
  email: "invalid-email", // Oops! Invalid email format
};

// With schemas - type-safe and validated
const userSchema = s.object({
  name: s.string(),
  age: s.number().min(0).max(120),
  email: s.string().email(),
});

// TypeScript knows the exact types
type User = InferType<typeof userSchema>;
// User = { name: string; age: number; email: string; }

// Type checking ensures data structure matches schema
const result = userSchema.validate(user);
if (!result.valid) {
  console.log("Type errors:", result.errors);
}
```

### 2. **Type Safety and Constraints**

Schemas ensure data structure matches your defined types, reducing bugs and improving data quality:

```typescript
const productSchema = s.object({
  id: s.string().key().identity(),
  name: s.string().min(1).max(100),
  price: s.number().min(0).precision(2),
  category: s.literal("electronics", "clothing", "books"),
  tags: s.array(s.string()).min(1).max(10),
  inStock: s.boolean().default(true),
});

// This will ensure type safety:
// - Name is a string with length constraints
// - Price is a number with precision constraints
// - Category is one of the allowed literal values
// - Tags array has size constraints
// - InStock defaults to true if not provided
```

### 3. **Self-Documenting Code**

Schemas serve as living documentation of your data structures:

```typescript
// Clear, readable data definition
const orderSchema = s.object({
  id: s.string().key().identity(),
  customerId: s.string().key(),
  items: s
    .array(
      s.object({
        productId: s.string().key(),
        quantity: s.number().min(1),
        unitPrice: s.number().min(0),
        totalPrice: s
          .number()
          .computed((item) => item.quantity * item.unitPrice),
      })
    )
    .min(1),
  status: s.literal("pending", "confirmed", "shipped", "delivered"),
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().tracked(),
  totalAmount: s
    .number()
    .computed((order) =>
      order.items.reduce((sum, item) => sum + item.totalPrice, 0)
    ),
});

// Anyone reading this code immediately understands:
// - What an order contains
// - What fields are required vs optional
// - What values are allowed for each field
// - How computed fields work
```

### 4. **Automatic Features**

Schemas enable powerful features without additional code:

```typescript
const userSchema = s.object({
  id: s.string().key().identity(), // Auto-generates IDs
  email: s.string().email().unique(), // Enforces uniqueness
  name: s.string().index(), // Creates database indexes
  lastLogin: s.date().tracked(), // Tracks changes
  fullName: s.string().computed(
    (
      user // Computed property
    ) => `${user.firstName} ${user.lastName}`
  ),
});

// This schema automatically provides:
// - Unique ID generation
// - Email uniqueness enforcement
// - Database indexing for efficient queries
// - Change tracking for audit trails
// - Computed full name that updates automatically
```

### 5. **Consistent Data Handling**

Schemas ensure all parts of your application handle data the same way:

```typescript
// Define once, use everywhere
const userSchema = s.object({
  id: s.string().key().identity(),
  email: s.string().email(),
  name: s.string(),
});

// In your data store
const users = dataStore.collection(userSchema).create();

// In your API layer
app.post("/users", (req, res) => {
  const result = userSchema.validate(req.body);
  if (!result.valid) {
    return res.status(400).json({ errors: result.errors });
  }
  // Data structure matches schema
});

// In your frontend
const createUser = async (userData: CreateUser) => {
  // TypeScript ensures userData matches the schema
  const response = await fetch("/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });
};
```

### 6. **Performance Optimization**

Schemas enable automatic performance optimizations:

```typescript
const productSchema = s.object({
  id: s.string().key().identity(),
  name: s.string().index(), // Indexed for fast searches
  category: s.string().index("cat_price"), // Compound index
  price: s.number().index("cat_price"), // Same compound index
  tags: s.array(s.string()).index(), // Array indexing
});

// This schema automatically creates:
// - Single field indexes for fast lookups
// - Compound indexes for multi-field queries
// - Array indexes for tag-based searches
// - Optimized query plans
```

### 7. **Change Tracking and History**

Schemas enable powerful change tracking features:

```typescript
const documentSchema = s.object({
  id: s.string().key().identity(),
  content: s.string().tracked(), // Track content changes
  version: s.number().identity(), // Auto-increment version
  lastModified: s.date().tracked(), // Track modification dates
  modifiedBy: s.string().tracked(), // Track who made changes
});

// With this schema, you automatically get:
// - Complete change history
// - Version control
// - Audit trails
// - Rollback capabilities
```

### 8. **Serialization and Persistence**

Schemas handle data transformation automatically:

```typescript
const userSchema = s.object({
  id: s.string().key().identity(),
  createdAt: s
    .date()
    .serialize((date) => date.toISOString()) // To string for storage
    .deserialize((str) => new Date(str)), // From string to Date
  settings: s
    .object({
      theme: s.string(),
      language: s.string(),
    })
    .serialize((settings) => JSON.stringify(settings)) // To JSON string
    .deserialize((str) => JSON.parse(str)), // From JSON string
});

// Automatic handling of:
// - Date serialization/deserialization
// - Complex object persistence
// - Data format conversions
// - Storage optimization
```

## Real-World Examples

### E-commerce Application

```typescript
const productSchema = s.object({
  id: s.string().key().identity(),
  name: s.string().min(1).max(200).index(),
  description: s.string().max(1000),
  price: s.number().min(0).precision(2).index(),
  category: s.string().index(),
  tags: s.array(s.string()).index(),
  images: s.array(s.string().url()),
  inStock: s.boolean().default(true),
  rating: s.number().min(0).max(5).default(0),
  reviewCount: s.number().min(0).default(0),
  averageRating: s
    .number()
    .computed((product) =>
      product.reviewCount > 0 ? product.rating / product.reviewCount : 0
    ),
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().tracked(),
});

// Benefits:
// - Type-safe price constraints
// - Efficient category and tag searches
// - Computed average rating
// - Change tracking for inventory management
// - Type-safe product operations
```

### User Management System

```typescript
const userSchema = s.object({
  id: s.string().key().identity(),
  email: s.string().email().unique().index(),
  username: s.string().min(3).max(30).unique().index(),
  password: s
    .string()
    .min(8)
    .validate((password) => {
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      return hasUpper && hasLower && hasNumber;
    }),
  firstName: s.string().min(1).max(50),
  lastName: s.string().min(1).max(50),
  fullName: s.string().computed((user) => `${user.firstName} ${user.lastName}`),
  role: s.literal("user", "moderator", "admin").default("user"),
  isActive: s.boolean().default(true),
  lastLogin: s.date().tracked(),
  loginCount: s.number().min(0).default(0),
  createdAt: s.date().default(() => new Date()),
  updatedAt: s.date().tracked(),
});

// Benefits:
// - Secure password constraints
// - Unique email and username enforcement
// - Automatic full name computation
// - Role-based access control
// - Login tracking and analytics
```

## When Not to Use Schemas

While schemas are powerful, they're not always necessary:

### **Simple Data Structures**

```typescript
// Simple configuration object - schema might be overkill
const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
  retries: 3,
};
```

### **Temporary Data**

```typescript
// Temporary UI state - no persistence needed
const formState = {
  name: "",
  email: "",
  message: "",
};
```

### **External API Responses**

```typescript
// External data you don't control
const externalData = await fetchExternalApi();
// Check structure only where needed
```

## Best Practices

### 1. **Start Simple**

```typescript
// Begin with basic type definitions
const simpleSchema = s.object({
  id: s.string().key().identity(),
  name: s.string(),
  email: s.string().email(),
});

// Add complexity as needed
const complexSchema = s.object({
  id: s.string().key().identity(),
  name: s.string().min(1).max(100).index(),
  email: s.string().email().unique().index(),
  profile: s.object({
    bio: s.string().max(500),
    avatar: s.string().url().optional(),
  }),
  preferences: s.object({
    theme: s.literal("light", "dark", "auto").default("auto"),
    notifications: s.boolean().default(true),
  }),
});
```

### 2. **Check Structure Early**

```typescript
// Validate at the boundary of your system
app.post("/users", (req, res) => {
  const result = userSchema.validate(req.body);
  if (!result.valid) {
    return res.status(400).json({ errors: result.errors });
  }
  // Process valid data
});
```

### 3. **Use Computed Properties**

```typescript
// Instead of computing in queries
const fullName = s
  .string()
  .computed((user) => `${user.firstName} ${user.lastName}`);

// Avoid computing in application code
// const fullName = `${user.firstName} ${user.lastName}`;
```

### 4. **Leverage Type Inference**

```typescript
// Let TypeScript do the work
type User = InferType<typeof userSchema>;
type CreateUser = InferCreateType<typeof userSchema>;

// Use inferred types everywhere
function createUser(data: CreateUser): Promise<User> { ... }
```

## Conclusion

Schemas in Routier provide a powerful foundation for building robust, type-safe, and performant applications. They offer:

- **Type Safety** - Compile-time type checking and structure validation
- **Automatic Features** - Indexing, change tracking, computed properties
- **Consistency** - Uniform data handling across your application
- **Performance** - Automatic optimizations and efficient queries
- **Maintainability** - Self-documenting, living data definitions

By embracing schemas, you'll build applications that are more reliable, performant, and easier to maintain. The initial investment in defining schemas pays dividends throughout your application's lifecycle.

## Next Steps

- [Creating A Schema](creating-a-schema.md) - Learn how to create schemas
- [Property Types](property-types/README.md) - Explore available property types
- [Modifiers](modifiers/README.md) - Understand property modifiers
- [Schema Reference](reference.md) - Complete API reference
